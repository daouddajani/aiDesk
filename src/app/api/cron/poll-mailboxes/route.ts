import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  refreshAccessToken,
  listNewInboxMessages,
  listMessageAttachments,
} from "@/lib/microsoftGraph";
import { fetchNewImapMessages } from "@/lib/imapPoll";
import {
  ingestIncomingEmail,
  type AgentEmailMap,
  type IncomingEmail,
} from "@/lib/ticketIngestion";
import { getAIProviderForCompany, type AIProvider, type AgentSkills } from "@/lib/ai";
import { stripQuotedReply } from "@/lib/emailQuote";

export const maxDuration = 300;

// Runs classify() + suggestAgent() for one message. checkJunk gates whether
// the AI's isJunk verdict is honored — Graph's own inferenceClassification
// already filters junk for the Microsoft path, so only IMAP (no such signal)
// relies on the AI fallback, per app.md's junk-detection rule. A null
// provider (AI disabled/unconfigured for this company) and any AI failure
// are both non-fatal: the ticket still gets created, just without a
// suggestion. The quoted-reply chain is always stripped first (deterministic,
// no AI needed) — the AI's cleanBody only strips signature blocks on top of
// that when a provider is configured.
async function classifyForTicket(
  aiProvider: AIProvider | null,
  agents: AgentSkills[],
  subject: string,
  bodyText: string,
  checkJunk: boolean,
): Promise<{
  isJunk: boolean;
  suggestedAgentId: string | null;
  cleanBody: string;
}> {
  const quoteStripped = stripQuotedReply(bodyText);

  if (!aiProvider)
    return { isJunk: false, suggestedAgentId: null, cleanBody: quoteStripped };
  try {
    const classification = await aiProvider.classify(subject, quoteStripped);
    if (checkJunk && classification.isJunk) {
      return {
        isJunk: true,
        suggestedAgentId: null,
        cleanBody: classification.cleanBody,
      };
    }
    const suggestedAgentId = await aiProvider.suggestAgent(
      classification.category,
      agents,
    );
    return {
      isJunk: false,
      suggestedAgentId,
      cleanBody: classification.cleanBody,
    };
  } catch {
    return { isJunk: false, suggestedAgentId: null, cleanBody: quoteStripped };
  }
}

async function loadAgentSkills(
  adminClient: ReturnType<typeof createAdminClient>,
  companyId: string,
): Promise<AgentSkills[]> {
  const { data } = await adminClient
    .from("profiles")
    .select("id, skills")
    .eq("company_id", companyId)
    .in("role", ["company_admin", "company_agent"]);

  return (data ?? []).map((p) => ({ id: p.id, skills: p.skills ?? [] }));
}

// Maps an agent's own mailbox address to their profile id, so a reply
// polled from the company mailbox that was actually sent by one of the
// company's own agents (not the requester) can be attributed correctly.
async function loadAgentEmailMap(
  adminClient: ReturnType<typeof createAdminClient>,
  agents: AgentSkills[],
): Promise<AgentEmailMap> {
  const map: AgentEmailMap = new Map();
  if (agents.length === 0) return map;

  const agentIds = new Set(agents.map((a) => a.id));
  const { data } = await adminClient.auth.admin.listUsers({ perPage: 1000 });

  for (const user of data?.users ?? []) {
    if (user.email && agentIds.has(user.id)) {
      map.set(user.email.toLowerCase(), user.id);
    }
  }

  return map;
}

type MailboxCompany = {
  id: string;
  default_agent_id: string | null;
  mailbox_provider: "microsoft" | "imap";
  mailbox_last_synced_at: string | null;
  mailbox_last_uid: number | null;
  mailbox_imap_config: {
    imapHost: string;
    imapPort: number;
    username: string;
  } | null;
};

async function pollMicrosoftCompany(
  adminClient: ReturnType<typeof createAdminClient>,
  company: MailboxCompany,
) {
  const { data: refreshToken } = await adminClient.rpc(
    "get_company_mailbox_secret",
    { p_company_id: company.id },
  );
  if (!refreshToken)
    return { created: 0, matchedReplies: 0, skippedJunk: 0, errors: [] };

  const tokens = await refreshAccessToken(refreshToken);

  // Microsoft rotates the refresh token on every use — persist immediately
  // or the connection breaks on the next poll.
  await adminClient.rpc("set_company_mailbox_secret", {
    p_company_id: company.id,
    p_secret: tokens.refresh_token,
    p_mailbox_email: null,
    p_provider: "microsoft",
  });

  const sinceIso = company.mailbox_last_synced_at ?? new Date().toISOString();
  const messages = await listNewInboxMessages(tokens.access_token, sinceIso);
  const agents = await loadAgentSkills(adminClient, company.id);
  const agentEmailMap = await loadAgentEmailMap(adminClient, agents);
  const aiProvider = await getAIProviderForCompany(adminClient, company.id);

  let created = 0;
  let matchedReplies = 0;
  let skippedJunk = 0;
  const errors: string[] = [];
  let latestReceivedAt = company.mailbox_last_synced_at;

  for (const message of messages) {
    if (
      !latestReceivedAt ||
      message.receivedDateTime > latestReceivedAt
    ) {
      latestReceivedAt = message.receivedDateTime;
    }

    // Graph's own Focused/Other classification is the junk signal here —
    // "other" is treated as junk outright, no AI call needed.
    if (message.inferenceClassification === "other") {
      skippedJunk += 1;
      continue;
    }

    const attachments = message.hasAttachments
      ? await listMessageAttachments(tokens.access_token, message.id)
      : [];

    const { suggestedAgentId, cleanBody } = await classifyForTicket(
      aiProvider,
      agents,
      message.subject ?? "",
      message.bodyText,
      false,
    );

    const email: IncomingEmail = {
      subject: message.subject,
      fromEmail: message.fromEmail,
      fromName: message.fromName,
      bodyText: cleanBody,
      receivedAt: message.receivedDateTime,
      conversationId: message.conversationId,
      threadRefs: [],
      sourceMessageId: message.id,
      attachments: attachments.map((a) => ({
        filename: a.filename,
        mimeType: a.mimeType,
        size: a.size,
        content: Buffer.from(a.contentBytes, "base64"),
      })),
    };

    const result = await ingestIncomingEmail(
      adminClient,
      company.id,
      company.default_agent_id,
      email,
      suggestedAgentId,
      agentEmailMap,
    );
    if ("ticketId" in result) {
      if (result.matched) matchedReplies += 1;
      else created += 1;
    } else if ("error" in result) errors.push(`${message.id}: ${result.error}`);
  }

  if (latestReceivedAt !== company.mailbox_last_synced_at) {
    await adminClient
      .from("companies")
      .update({ mailbox_last_synced_at: latestReceivedAt })
      .eq("id", company.id);
  }

  return { created, matchedReplies, skippedJunk, errors };
}

async function pollImapCompany(
  adminClient: ReturnType<typeof createAdminClient>,
  company: MailboxCompany,
) {
  if (!company.mailbox_imap_config)
    return { created: 0, matchedReplies: 0, skippedJunk: 0, errors: [] };

  const { data: password } = await adminClient.rpc(
    "get_company_mailbox_secret",
    { p_company_id: company.id },
  );
  if (!password)
    return { created: 0, matchedReplies: 0, skippedJunk: 0, errors: [] };

  const { messages, newUidNext } = await fetchNewImapMessages(
    {
      host: company.mailbox_imap_config.imapHost,
      port: company.mailbox_imap_config.imapPort,
      username: company.mailbox_imap_config.username,
      password,
    },
    company.mailbox_last_uid ?? 0,
  );
  const agents = await loadAgentSkills(adminClient, company.id);
  const agentEmailMap = await loadAgentEmailMap(adminClient, agents);
  const aiProvider = await getAIProviderForCompany(adminClient, company.id);

  let created = 0;
  let matchedReplies = 0;
  let skippedJunk = 0;
  const errors: string[] = [];

  // No Graph-style classification signal exists over plain IMAP, so the AI
  // classifier's isJunk verdict is the junk filter here, per app.md. If AI
  // is disabled for this company, every message becomes a ticket, same as
  // before this feature existed.
  for (const message of messages) {
    const { isJunk, suggestedAgentId, cleanBody } = await classifyForTicket(
      aiProvider,
      agents,
      message.subject ?? "",
      message.bodyText,
      true,
    );
    if (isJunk) {
      skippedJunk += 1;
      continue;
    }

    const email: IncomingEmail = {
      subject: message.subject,
      fromEmail: message.fromEmail,
      fromName: message.fromName,
      bodyText: cleanBody,
      receivedAt: message.receivedAt,
      conversationId: null,
      threadRefs: message.threadRefs,
      sourceMessageId: message.messageId ?? `imap-uid-${message.uid}`,
      attachments: message.attachments,
    };

    const result = await ingestIncomingEmail(
      adminClient,
      company.id,
      company.default_agent_id,
      email,
      suggestedAgentId,
      agentEmailMap,
    );
    if ("ticketId" in result) {
      if (result.matched) matchedReplies += 1;
      else created += 1;
    } else if ("error" in result)
      errors.push(`${message.messageId ?? message.uid}: ${result.error}`);
  }

  if (newUidNext !== company.mailbox_last_uid) {
    await adminClient
      .from("companies")
      .update({ mailbox_last_uid: newUidNext })
      .eq("id", company.id);
  }

  return { created, matchedReplies, skippedJunk, errors };
}

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const adminClient = createAdminClient();
  const { data: companies, error } = await adminClient
    .from("companies")
    .select(
      "id, default_agent_id, mailbox_provider, mailbox_last_synced_at, mailbox_last_uid, mailbox_imap_config",
    )
    .not("mailbox_provider", "is", null);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const results = [];

  for (const company of (companies ?? []) as MailboxCompany[]) {
    try {
      const summary =
        company.mailbox_provider === "microsoft"
          ? await pollMicrosoftCompany(adminClient, company)
          : await pollImapCompany(adminClient, company);
      results.push({ companyId: company.id, ...summary });
    } catch (err) {
      results.push({
        companyId: company.id,
        error: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }

  return NextResponse.json({ polled: results.length, results });
}
