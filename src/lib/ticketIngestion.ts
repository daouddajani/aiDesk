import type { SupabaseClient } from "@supabase/supabase-js";
import crypto from "node:crypto";

export type IncomingEmailAttachment = {
  filename: string;
  mimeType: string;
  size: number;
  content: Buffer;
  // Content-ID and inline flag for images embedded in the email body
  // (<img src="cid:...">) rather than attached as a regular file. The body
  // is stored as plain text so the cid: reference itself is dropped, but
  // preserving these lets the attachment still show up (tagged) instead of
  // silently disappearing.
  contentId: string | null;
  isInline: boolean;
};

export type IncomingEmail = {
  subject: string | null;
  fromEmail: string | null;
  fromName: string | null;
  bodyText: string;
  receivedAt: string;
  // Graph's server-assigned thread id (Microsoft path only).
  conversationId: string | null;
  // IMAP path only: In-Reply-To / References header values, used to detect
  // "this is a reply to an earlier message" since IMAP has no equivalent of
  // Graph's conversationId.
  threadRefs: string[];
  // Stable per-message identifier (Graph message id, or IMAP Message-ID /
  // UID fallback) — the sole dedup key. Cursor timestamps/UIDs advance the
  // polling window but aren't precise enough on their own: Graph's
  // receivedDateTime can lose sub-second precision on the round trip
  // through Postgres, causing the same message to match a "gt cursor"
  // filter again on the next poll.
  sourceMessageId: string;
  attachments: IncomingEmailAttachment[];
};

// email(lowercase) -> profile id, for agents of the company being polled.
export type AgentEmailMap = Map<string, string>;

function sanitizeFilename(name: string) {
  return name.replace(/[/\\]/g, "_").slice(0, 200) || "attachment";
}

async function persistAttachments(
  adminClient: SupabaseClient,
  companyId: string,
  ownerPathPrefix: string,
  attachments: IncomingEmailAttachment[],
  row: { ticket_id: string } | { comment_id: string },
) {
  for (const attachment of attachments) {
    let contentHash: string | null = null;

    if (attachment.isInline) {
      contentHash = crypto
        .createHash("sha256")
        .update(attachment.content)
        .digest("hex");

      // A recurring inline image (e.g. a signature/logo baked into every
      // outgoing email from this company's mailbox) already on file for
      // this company — skip it here, but keep processing the rest of this
      // message's attachments normally. First occurrence of any inline
      // image, logo included, still gets attached once.
      const { data: existing } = await adminClient
        .from("attachments")
        .select("id")
        .eq("company_id", companyId)
        .eq("content_hash", contentHash)
        .limit(1)
        .maybeSingle();

      if (existing) continue;
    }

    const path = `${ownerPathPrefix}/${sanitizeFilename(attachment.filename)}`;

    const { error: uploadError } = await adminClient.storage
      .from("attachments")
      .upload(path, attachment.content, {
        contentType: attachment.mimeType,
        upsert: false,
      });

    // Storage bucket policies (mime type / 25MB size limit) reject
    // disallowed attachments here; skip just that attachment, not the
    // whole ticket/comment.
    if (uploadError) continue;

    await adminClient.from("attachments").insert({
      ...row,
      company_id: companyId,
      storage_path: path,
      filename: attachment.filename,
      mime_type: attachment.mimeType,
      size: attachment.size,
      content_id: attachment.contentId,
      is_inline: attachment.isInline,
      content_hash: contentHash,
    });
  }
}

// Looks for a ticket this reply belongs to: Graph conversationId first, then
// IMAP In-Reply-To/References chain. Picks the earliest ticket in the
// company if more than one somehow shares the same thread signal. A DB error
// here must not be treated as "no match" — that would silently create a
// duplicate ticket for what's actually a reply, so it's surfaced as an
// error instead and the caller skips the message rather than guessing.
//
// A ticket whose own source_message_id equals this email's is excluded from
// matching: that means this is the very message that created the ticket,
// re-fetched on a later poll (Graph's receivedDateTime can lose sub-second
// precision through Postgres, letting the same message pass the "gt cursor"
// filter again — see IncomingEmail.sourceMessageId). Matching it here would
// record it as a reply to itself, duplicating the original body as a fake
// activity entry. Falling through instead lets createTicketFromEmail's own
// (company_id, source_message_id) dedup correctly recognize it as a no-op.
async function findMatchingTicketId(
  adminClient: SupabaseClient,
  companyId: string,
  email: IncomingEmail,
): Promise<{ ticketId: string | null } | { error: string }> {
  if (email.conversationId) {
    const { data, error } = await adminClient
      .from("tickets")
      .select("id, source_message_id")
      .eq("company_id", companyId)
      .eq("graph_conversation_id", email.conversationId)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (error) return { error: error.message };
    if (data && data.source_message_id !== email.sourceMessageId) {
      return { ticketId: data.id };
    }
  }

  if (email.threadRefs.length > 0) {
    const { data, error } = await adminClient
      .from("tickets")
      .select("id, source_message_id")
      .eq("company_id", companyId)
      .in("source_message_id", email.threadRefs)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (error) return { error: error.message };
    if (data && data.source_message_id !== email.sourceMessageId) {
      return { ticketId: data.id };
    }
  }

  return { ticketId: null };
}

// A matched agent replying from their own mailbox is both "taking
// ownership" and "actively working" in one step — collapses assignTicket's
// new→pending and addComment's pending→on_process transitions. Closed
// tickets are left alone (same restriction as reassignment in the
// dashboard); the reply still gets recorded as a comment by the caller.
async function autoAssignFromAgentReply(
  adminClient: SupabaseClient,
  companyId: string,
  ticketId: string,
  agentId: string,
) {
  const { data: ticket } = await adminClient
    .from("tickets")
    .select("status, assigned_agent_id")
    .eq("id", ticketId)
    .single();

  if (!ticket || ticket.status === "closed") return;

  const nextStatus =
    ticket.status === "new" || ticket.status === "pending"
      ? "on_process"
      : ticket.status;

  if (ticket.assigned_agent_id !== agentId) {
    await adminClient
      .from("tickets")
      .update({ assigned_agent_id: agentId, status: nextStatus })
      .eq("id", ticketId);

    await adminClient.from("ticket_assignment_log").insert({
      ticket_id: ticketId,
      company_id: companyId,
      changed_by: agentId,
      previous_agent_id: ticket.assigned_agent_id,
      new_agent_id: agentId,
    });
  } else if (ticket.status !== nextStatus) {
    await adminClient
      .from("tickets")
      .update({ status: nextStatus })
      .eq("id", ticketId);
  }
}

// Records an inbound reply as a ticket_comments row instead of a new
// ticket. matchedAgentId set means the sender is a known agent replying
// from their own mailbox (author_id = their profile, non-internal, and
// triggers auto-assignment); null means an external sender (the requester,
// or anyone else on the thread), recorded via external_author_email/name.
async function attachReplyToTicket(
  adminClient: SupabaseClient,
  companyId: string,
  ticketId: string,
  email: IncomingEmail,
  matchedAgentId: string | null,
): Promise<{ commentId: string; duplicate?: false } | { duplicate: true } | { error: string }> {
  const { data: commentRows, error: insertError } = await adminClient
    .from("ticket_comments")
    .upsert(
      {
        ticket_id: ticketId,
        author_id: matchedAgentId,
        external_author_email: matchedAgentId ? null : email.fromEmail,
        external_author_name: matchedAgentId ? null : email.fromName,
        body: email.bodyText || "(empty message)",
        is_internal: false,
        source_message_id: email.sourceMessageId,
      },
      { onConflict: "ticket_id,source_message_id", ignoreDuplicates: true },
    )
    .select("id");

  if (insertError) {
    return { error: insertError.message };
  }
  if (!commentRows || commentRows.length === 0) {
    return { duplicate: true };
  }
  const comment = commentRows[0];

  await persistAttachments(
    adminClient,
    companyId,
    `${companyId}/${comment.id}`,
    email.attachments,
    { comment_id: comment.id },
  );

  if (matchedAgentId) {
    await autoAssignFromAgentReply(adminClient, companyId, ticketId, matchedAgentId);
  }

  return { commentId: comment.id };
}

// Uses the admin (service-role) client — mailbox polling runs unauthenticated
// as a cron job, not on behalf of any signed-in user, so RLS doesn't apply.
export async function createTicketFromEmail(
  adminClient: SupabaseClient,
  companyId: string,
  defaultAgentId: string | null,
  email: IncomingEmail,
  aiSuggestedAgentId: string | null = null,
): Promise<{ ticketId: string; duplicate?: false } | { duplicate: true } | { error: string }> {
  if (!email.fromEmail) {
    return { error: "Message has no sender address, skipped." };
  }

  const { data: ticketRows, error: insertError } = await adminClient
    .from("tickets")
    .upsert(
      {
        company_id: companyId,
        subject: email.subject || "(no subject)",
        sender_email: email.fromEmail,
        sender_name: email.fromName,
        description: email.bodyText || "(empty message)",
        received_at: email.receivedAt,
        status: "new",
        assigned_agent_id: defaultAgentId,
        ai_suggested_agent_id: aiSuggestedAgentId,
        graph_conversation_id: email.conversationId,
        source_message_id: email.sourceMessageId,
      },
      { onConflict: "company_id,source_message_id", ignoreDuplicates: true },
    )
    .select("id");

  if (insertError) {
    return { error: insertError.message };
  }
  if (!ticketRows || ticketRows.length === 0) {
    return { duplicate: true };
  }
  const ticket = ticketRows[0];

  await persistAttachments(
    adminClient,
    companyId,
    `${companyId}/${ticket.id}`,
    email.attachments,
    { ticket_id: ticket.id },
  );

  return { ticketId: ticket.id };
}

// Single entry point mailbox polling should call: matches the message to an
// existing ticket by thread (Graph conversationId or IMAP In-Reply-To/
// References) and records it as an activity comment there; only falls back
// to creating a new ticket when no matching ticket is found.
export async function ingestIncomingEmail(
  adminClient: SupabaseClient,
  companyId: string,
  defaultAgentId: string | null,
  email: IncomingEmail,
  aiSuggestedAgentId: string | null,
  agentEmailMap: AgentEmailMap,
): Promise<
  | { ticketId: string; matched: true; duplicate?: false }
  | { ticketId: string; matched: false; duplicate?: false }
  | { duplicate: true }
  | { error: string }
> {
  const match = await findMatchingTicketId(adminClient, companyId, email);
  if ("error" in match) return match;

  if (match.ticketId) {
    const matchedTicketId = match.ticketId;
    const matchedAgentId = email.fromEmail
      ? (agentEmailMap.get(email.fromEmail.toLowerCase()) ?? null)
      : null;

    const result = await attachReplyToTicket(
      adminClient,
      companyId,
      matchedTicketId,
      email,
      matchedAgentId,
    );
    if ("commentId" in result) return { ticketId: matchedTicketId, matched: true };
    return result;
  }

  const created = await createTicketFromEmail(
    adminClient,
    companyId,
    defaultAgentId,
    email,
    aiSuggestedAgentId,
  );
  if ("ticketId" in created) return { ...created, matched: false };
  return created;
}
