import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import { stripHtml } from "@/lib/htmlText";

export type ParsedIncomingMessage = {
  uid: number;
  subject: string | null;
  fromName: string | null;
  fromEmail: string | null;
  receivedAt: string;
  bodyText: string;
  messageId: string | null;
  attachments: {
    filename: string;
    mimeType: string;
    size: number;
    content: Buffer;
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
        messages.push({
          uid: msg.uid,
          subject: parsed.subject ?? null,
          fromName: parsed.from?.value?.[0]?.name ?? null,
          fromEmail: parsed.from?.value?.[0]?.address ?? null,
          receivedAt: (parsed.date ?? new Date()).toISOString(),
          bodyText:
            parsed.text ?? (parsed.html ? stripHtml(parsed.html) : ""),
          messageId: parsed.messageId ?? null,
          attachments: (parsed.attachments ?? []).map((a) => ({
            filename: a.filename ?? "attachment",
            mimeType: a.contentType ?? "application/octet-stream",
            size: a.size ?? a.content.length,
            content: a.content,
          })),
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
