import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import { stripHtml } from "@/lib/htmlText";
import { extractInlineImages } from "@/lib/extractInlineImages";

export type ParsedIncomingMessage = {
  uid: number;
  subject: string | null;
  fromName: string | null;
  fromEmail: string | null;
  receivedAt: string;
  bodyText: string;
  messageId: string | null;
  // Reply-chain identifiers (In-Reply-To / References headers) — the only
  // way to detect "this is a reply to an earlier message" over plain IMAP,
  // since there's no server-assigned thread id like Graph's conversationId.
  threadRefs: string[];
  // Everyone in the To/Cc line of the original message — used to build the
  // ticket's watcher list so replies can Cc them, not just the sender.
  recipients: { name: string | null; address: string }[];
  attachments: {
    filename: string;
    mimeType: string;
    size: number;
    content: Buffer;
    contentId: string | null;
    isInline: boolean;
  }[];
};

type ImapConfig = {
  host: string;
  port: number;
  username: string;
  password: string;
};

// sinceUid is the last UID already processed; only strictly-greater UIDs
// are fetched. Callers must seed this at connect time to the mailbox's
// current uidNext — otherwise the first poll would backfill the entire
// mailbox history as tickets.
export async function fetchNewImapMessages(
  config: ImapConfig,
  sinceUid: number,
): Promise<{ messages: ParsedIncomingMessage[]; newUidNext: number }> {
  const client = new ImapFlow({
    host: config.host,
    port: config.port,
    secure: true,
    auth: { user: config.username, pass: config.password },
    logger: false,
  });

  const messages: ParsedIncomingMessage[] = [];
  let newUidNext = sinceUid;

  await client.connect();
  try {
    const mailboxInfo = await client.mailboxOpen("INBOX");
    newUidNext = mailboxInfo.uidNext ? mailboxInfo.uidNext - 1 : sinceUid;

    if (newUidNext > sinceUid) {
      for await (const msg of client.fetch(
        `${sinceUid + 1}:*`,
        { uid: true, source: true },
        { uid: true },
      )) {
        if (msg.uid <= sinceUid || !msg.source) continue;

        const parsed = await simpleParser(msg.source);
        const inlineImages = parsed.html ? extractInlineImages(parsed.html) : [];
        messages.push({
          uid: msg.uid,
          subject: parsed.subject ?? null,
          fromName: parsed.from?.value?.[0]?.name ?? null,
          fromEmail: parsed.from?.value?.[0]?.address ?? null,
          receivedAt: (parsed.date ?? new Date()).toISOString(),
          bodyText:
            parsed.text ?? (parsed.html ? stripHtml(parsed.html) : ""),
          messageId: parsed.messageId ?? null,
          threadRefs: [
            parsed.inReplyTo,
            ...(Array.isArray(parsed.references)
              ? parsed.references
              : parsed.references
                ? [parsed.references]
                : []),
          ].filter((id): id is string => Boolean(id)),
          recipients: [
            ...(parsed.to
              ? Array.isArray(parsed.to)
                ? parsed.to.flatMap((a) => a.value)
                : parsed.to.value
              : []),
            ...(parsed.cc
              ? Array.isArray(parsed.cc)
                ? parsed.cc.flatMap((a) => a.value)
                : parsed.cc.value
              : []),
          ]
            .map((v) => ({ name: v.name || null, address: v.address ?? "" }))
            .filter((r) => r.address),
          attachments: [
            ...(parsed.attachments ?? []).map((a) => ({
              filename: a.filename ?? "attachment",
              mimeType: a.contentType ?? "application/octet-stream",
              size: a.size ?? a.content.length,
              content: a.content,
              contentId: a.contentId ?? null,
              isInline: a.related === true || a.contentDisposition === "inline",
            })),
            ...inlineImages.map((img) => ({
              filename: img.filename,
              mimeType: img.mimeType,
              size: img.content.length,
              content: img.content,
              contentId: null,
              isInline: true,
            })),
          ],
        });
      }
    }
  } finally {
    await client.logout();
  }

  return { messages, newUidNext };
}

// Used at connect time to seed the cursor without processing any history.
export async function getCurrentImapUidNext(
  config: ImapConfig,
): Promise<number> {
  const client = new ImapFlow({
    host: config.host,
    port: config.port,
    secure: true,
    auth: { user: config.username, pass: config.password },
    logger: false,
  });

  await client.connect();
  try {
    const mailboxInfo = await client.mailboxOpen("INBOX");
    return mailboxInfo.uidNext ? mailboxInfo.uidNext - 1 : 0;
  } finally {
    await client.logout();
  }
}
