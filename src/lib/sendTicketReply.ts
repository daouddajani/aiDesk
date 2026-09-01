import type { SupabaseClient } from "@supabase/supabase-js";
import nodemailer from "nodemailer";
import { refreshAccessToken } from "./microsoftGraph";

type ReplyAttachment = {
  filename: string;
  mimeType: string;
  content: Buffer;
};

export type ReplyRecipient = { name: string | null; address: string };

type ReplyCompany = {
  id: string;
  mailbox_provider: "microsoft" | "imap" | null;
  mailbox_imap_config: {
    smtpHost: string;
    smtpPort: number;
    username: string;
  } | null;
};

type ReplyTicket = {
  source_message_id: string | null;
  sender_email: string;
  subject: string;
};

async function persistRotatedRefreshToken(
  adminClient: SupabaseClient,
  companyId: string,
  refreshToken: string,
) {
  await adminClient.rpc("set_company_mailbox_secret", {
    p_company_id: companyId,
    p_secret: refreshToken,
    p_mailbox_email: null,
    p_provider: "microsoft",
  });
}

async function sendGraphReply(
  adminClient: SupabaseClient,
  company: ReplyCompany,
  ticket: ReplyTicket,
  bodyText: string,
  attachments: ReplyAttachment[],
  cc: ReplyRecipient[],
): Promise<{ error?: string }> {
  if (!ticket.source_message_id) {
    return { error: "This ticket has no source email to reply to." };
  }

  const { data: refreshToken } = await adminClient.rpc(
    "get_company_mailbox_secret",
    { p_company_id: company.id },
  );
  if (!refreshToken) return { error: "Mailbox is not connected." };

  const tokens = await refreshAccessToken(refreshToken);
  await persistRotatedRefreshToken(adminClient, company.id, tokens.refresh_token);

  const headers = {
    Authorization: `Bearer ${tokens.access_token}`,
    "Content-Type": "application/json",
  };
  const base = `https://graph.microsoft.com/v1.0/me/messages/${ticket.source_message_id}`;

  if (attachments.length === 0 && cc.length === 0) {
    const res = await fetch(`${base}/reply`, {
      method: "POST",
      headers,
      body: JSON.stringify({ comment: bodyText }),
    });
    if (!res.ok) return { error: await res.text() };
    return {};
  }

  // Cc or attachments: the plain /reply endpoint can't add Cc recipients,
  // and the draft-based createReply/PATCH/attachments flow that would
  // support it needs Mail.ReadWrite — a scope some tenants gate behind
  // admin approval. Send as a fresh message via /sendMail instead (only
  // needs Mail.Send, already granted), preserving threading manually via
  // In-Reply-To/References headers set to the original message's RFC
  // Message-ID (its internetMessageId — distinct from the Graph id used to
  // address the message above) rather than relying on Graph's automatic
  // reply-threading.
  const lookupRes = await fetch(`${base}?$select=internetMessageId`, {
    headers,
  });
  if (!lookupRes.ok) return { error: await lookupRes.text() };
  const { internetMessageId } = (await lookupRes.json()) as {
    internetMessageId?: string;
  };

  const subject = ticket.subject.toLowerCase().startsWith("re:")
    ? ticket.subject
    : `Re: ${ticket.subject}`;

  const sendRes = await fetch("https://graph.microsoft.com/v1.0/me/sendMail", {
    method: "POST",
    headers,
    body: JSON.stringify({
      message: {
        subject,
        body: { contentType: "Text", content: bodyText },
        toRecipients: [{ emailAddress: { address: ticket.sender_email } }],
        ccRecipients: cc.map((r) => ({
          emailAddress: { address: r.address, name: r.name ?? undefined },
        })),
        attachments: attachments.map((attachment) => ({
          "@odata.type": "#microsoft.graph.fileAttachment",
          name: attachment.filename,
          contentType: attachment.mimeType,
          contentBytes: attachment.content.toString("base64"),
        })),
        internetMessageHeaders: internetMessageId
          ? [
              { name: "In-Reply-To", value: internetMessageId },
              { name: "References", value: internetMessageId },
            ]
          : [],
      },
      saveToSentItems: true,
    }),
  });
  if (!sendRes.ok) return { error: await sendRes.text() };
  return {};
}

async function sendImapReply(
  adminClient: SupabaseClient,
  company: ReplyCompany,
  ticket: ReplyTicket,
  bodyText: string,
  attachments: ReplyAttachment[],
  cc: ReplyRecipient[],
): Promise<{ error?: string }> {
  if (!company.mailbox_imap_config) {
    return { error: "Mailbox is not connected." };
  }

  const { data: password } = await adminClient.rpc(
    "get_company_mailbox_secret",
    { p_company_id: company.id },
  );
  if (!password) return { error: "Mailbox is not connected." };

  const config = company.mailbox_imap_config;
  const transport = nodemailer.createTransport({
    host: config.smtpHost,
    port: config.smtpPort,
    secure: config.smtpPort === 465,
    auth: { user: config.username, pass: password },
  });

  const subject = ticket.subject.toLowerCase().startsWith("re:")
    ? ticket.subject
    : `Re: ${ticket.subject}`;

  try {
    await transport.sendMail({
      from: config.username,
      to: ticket.sender_email,
      cc: cc.length > 0 ? cc.map((r) => ({ name: r.name ?? undefined, address: r.address })) : undefined,
      subject,
      text: bodyText,
      inReplyTo: ticket.source_message_id ?? undefined,
      references: ticket.source_message_id ?? undefined,
      attachments: attachments.map((a) => ({
        filename: a.filename,
        content: a.content,
        contentType: a.mimeType,
      })),
    });
  } catch (err) {
    return { error: err instanceof Error ? err.message : "SMTP send failed." };
  }

  return {};
}

async function sendGraphMail(
  adminClient: SupabaseClient,
  companyId: string,
  to: string,
  subject: string,
  html: string,
): Promise<{ error?: string }> {
  const { data: refreshToken } = await adminClient.rpc(
    "get_company_mailbox_secret",
    { p_company_id: companyId },
  );
  if (!refreshToken) return { error: "Mailbox is not connected." };

  const tokens = await refreshAccessToken(refreshToken);
  await persistRotatedRefreshToken(adminClient, companyId, tokens.refresh_token);

  const res = await fetch("https://graph.microsoft.com/v1.0/me/sendMail", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${tokens.access_token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      message: {
        subject,
        body: { contentType: "HTML", content: html },
        toRecipients: [{ emailAddress: { address: to } }],
      },
    }),
  });
  if (!res.ok) return { error: await res.text() };
  return {};
}

async function sendImapMail(
  adminClient: SupabaseClient,
  company: {
    id: string;
    mailbox_imap_config: { smtpHost: string; smtpPort: number; username: string } | null;
  },
  to: string,
  subject: string,
  html: string,
): Promise<{ error?: string }> {
  if (!company.mailbox_imap_config) {
    return { error: "Mailbox is not connected." };
  }

  const { data: password } = await adminClient.rpc(
    "get_company_mailbox_secret",
    { p_company_id: company.id },
  );
  if (!password) return { error: "Mailbox is not connected." };

  const config = company.mailbox_imap_config;
  const transport = nodemailer.createTransport({
    host: config.smtpHost,
    port: config.smtpPort,
    secure: config.smtpPort === 465,
    auth: { user: config.username, pass: password },
  });

  try {
    await transport.sendMail({ from: config.username, to, subject, html });
  } catch (err) {
    return { error: err instanceof Error ? err.message : "SMTP send failed." };
  }

  return {};
}

// Fresh (non-reply) mail through the company's own connected mailbox — used
// for notifications that aren't replying to any particular inbound message,
// unlike sendTicketReply below.
export async function sendCompanyMail(
  adminClient: SupabaseClient,
  company: {
    id: string;
    mailbox_provider: "microsoft" | "imap" | null;
    mailbox_imap_config: { smtpHost: string; smtpPort: number; username: string } | null;
  },
  to: string,
  subject: string,
  html: string,
): Promise<{ error?: string }> {
  if (company.mailbox_provider === "microsoft") {
    return sendGraphMail(adminClient, company.id, to, subject, html);
  }
  if (company.mailbox_provider === "imap") {
    return sendImapMail(adminClient, company, to, subject, html);
  }
  return { error: "No mailbox connected for this company." };
}

export async function sendTicketReply(
  adminClient: SupabaseClient,
  company: ReplyCompany,
  ticket: ReplyTicket,
  bodyText: string,
  attachments: ReplyAttachment[] = [],
  cc: ReplyRecipient[] = [],
): Promise<{ error?: string }> {
  if (company.mailbox_provider === "microsoft") {
    return sendGraphReply(adminClient, company, ticket, bodyText, attachments, cc);
  }
  if (company.mailbox_provider === "imap") {
    return sendImapReply(adminClient, company, ticket, bodyText, attachments, cc);
  }
  return { error: "No mailbox connected for this company." };
}
