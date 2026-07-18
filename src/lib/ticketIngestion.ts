import type { SupabaseClient } from "@supabase/supabase-js";

export type IncomingEmailAttachment = {
  filename: string;
  mimeType: string;
  size: number;
  content: Buffer;
};

export type IncomingEmail = {
  subject: string | null;
  fromEmail: string | null;
  fromName: string | null;
  bodyText: string;
  receivedAt: string;
  conversationId: string | null;
  // Stable per-message identifier (Graph message id, or IMAP Message-ID /
  // UID fallback) — the sole dedup key. Cursor timestamps/UIDs advance the
  // polling window but aren't precise enough on their own: Graph's
  // receivedDateTime can lose sub-second precision on the round trip
  // through Postgres, causing the same message to match a "gt cursor"
  // filter again on the next poll.
  sourceMessageId: string;
  attachments: IncomingEmailAttachment[];
};

function sanitizeFilename(name: string) {
  return name.replace(/[/\\]/g, "_").slice(0, 200) || "attachment";
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

  for (const attachment of email.attachments) {
    const path = `${companyId}/${ticket.id}/${sanitizeFilename(attachment.filename)}`;

    const { error: uploadError } = await adminClient.storage
      .from("attachments")
      .upload(path, attachment.content, {
        contentType: attachment.mimeType,
        upsert: false,
      });

    // Storage bucket policies (mime type / 25MB size limit) reject
    // disallowed attachments here; skip just that attachment, not the
    // whole ticket.
    if (uploadError) continue;

    await adminClient.from("attachments").insert({
      ticket_id: ticket.id,
      storage_path: path,
      filename: attachment.filename,
      mime_type: attachment.mimeType,
      size: attachment.size,
    });
  }

  return { ticketId: ticket.id };
}
