# Pasted-image attachment capture + recurring-image dedup — design

## Problem

An image pasted directly into an Outlook (or similar) compose body — not
attached as a file — produces a bare `<img src="data:image/png;base64,...">`
with no separate MIME part at all. This is invisible to both Microsoft
Graph's attachments API and IMAP's `mailparser`, and gets silently deleted
by `stripHtml()`'s tag-stripping during ingestion, with no trace left
anywhere. Separately, a signature/logo image baked into every outgoing
email from a company's mailbox — whether `cid:`-referenced (already
captured today) or pasted as a `data:` URI — creates a near-duplicate
attachment on every single ticket/comment from that mailbox, cluttering
every conversation.

## Scope

1. Extract `data:` URI images from the raw HTML body before `stripHtml()`
   runs, and attach them like any other inline image.
2. SHA-256-hash every inline image's bytes (both the new `data:`-URI case
   and the already-working `cid:` case) and skip attaching it again if that
   exact hash was already seen for the same company. First occurrence of
   any image — logo included — still attaches once; only exact repeats are
   suppressed. No AI, no image-dimension heuristics.

Out of scope: Gmail's hosted-image-URL style of embedding
(`<img src="https://mail.google.com/...">`, pointing at a remotely-hosted
copy rather than embedding the bytes) is a different, unrelated gap and is
not addressed here — the target confirmed for this feature is the
Outlook/`data:`-URI paste case specifically.

## Storage

```sql
alter table attachments
  add column company_id uuid references companies (id) on delete cascade,
  add column content_hash text;

create index attachments_company_content_hash_idx
  on attachments (company_id, content_hash)
  where content_hash is not null;
```

`company_id` is denormalized onto `attachments` purely so the dedup lookup
is a flat query, matching this codebase's established convention of no
embedded/nested PostgREST selects for cross-table joins (every join
elsewhere is a separate flat query + manual map). No backfill — dedup only
needs to match rows written from now on. No RLS changes — ingestion runs
exclusively through the service-role admin client, already bypassing RLS.
`content_hash` is only ever populated for `is_inline: true` rows; a
customer's regular file attachment is never hashed or deduped.

No local migrations directory exists in this repo; this SQL is run
directly against the remote Supabase project via the SQL editor, same as
every other schema change so far.

## Extraction

`src/lib/extractInlineImages.ts` — a small pure function, regex-matching
`<img src="data:image/...;base64,...">` (handles single/double quotes,
case-insensitivity, extra `;key=value` params before `;base64,`,
whitespace-wrapped base64, malformed/empty base64, and skips non-image
`data:` URIs).

Wired into both ingestion paths, reading the raw HTML body before it's
discarded:
- `src/lib/imapPoll.ts` — from `parsed.html` (mailparser's output).
- `src/lib/microsoftGraph.ts` (`GraphMessage.inlineImages`) +
  `src/app/api/cron/poll-mailboxes/route.ts` — from `m.body.content`,
  merged into `email.attachments` unconditionally (not gated behind
  `hasAttachments`, since Graph won't set that true for a body-only base64
  image).

Both merge with `contentId: null, isInline: true` — there's no MIME
`Content-ID` for a `data:` URI image.

## Dedup

Computed and checked in `persistAttachments()`
(`src/lib/ticketIngestion.ts`), gated on `attachment.isInline`: hash the
bytes via Node's built-in `crypto` module (no new dependency), look up
`attachments` flat-scoped by the new `company_id` + `content_hash`
columns, and skip the Storage upload + row insert entirely on a match —
while the rest of the message's attachments continue processing normally.

## Out of scope

- Gmail's hosted-image-URL embedding style (see above).
- Any UI change — the existing `/dashboard/tickets/[id]` attachments list
  already renders every `attachments` row unconditionally; no filtering or
  labeling by `is_inline`/`content_hash` was added there.
- Cross-company dedup — the recurring-image check is scoped to one
  company's own mailbox history, not global.
- Deduping regular (non-inline) file attachments.
