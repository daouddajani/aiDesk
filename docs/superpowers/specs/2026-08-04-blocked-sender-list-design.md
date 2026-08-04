# Blocked sender list — design

## Problem

Mailbox polling turns every non-junk inbound message into a ticket (or a
comment on a matched existing ticket). Company Admins have no way to stop a
specific sender's mail from ever becoming a ticket — e.g. a noisy automated
notification address that isn't classified as junk by Graph/AI but should
never reach the help desk.

## Scope

Per-company list of sender email addresses to ignore entirely during
mailbox polling. A message from a blocked address is neither turned into a
new ticket nor appended as a comment to an existing one — it's dropped
before any ticket-creation or reply-matching logic runs.

Match type: exact, case-insensitive match on the sender's email address.
No domain wildcards, no regex.

## Storage

New column on `companies`:

```sql
alter table public.companies
  add column blocked_sender_emails text[] not null default '{}'::text[];
```

Mirrors the existing `profiles.skills text[]` column — same type, same
"comma-separated text input, parsed server-side" editing convention. Values
are stored lowercased and trimmed.

No local migrations directory exists in this repo yet (schema currently
lives only in the remote Supabase project — see `CLAUDE.md`'s "known
follow-ups"). This SQL will be run directly against the remote project via
the Supabase SQL editor rather than added as a tracked migration file,
consistent with how the rest of the schema got there.

## Admin UI

`CompanySettingsForm.tsx` gains a new field, "Blocked sender emails,"
alongside name/timezone/default agent — a single text input, comma-separated,
same pattern as the agents page's `skills` field
(`EditAgentForm.tsx`).

`updateCompanySettings` (`settings/actions.ts`) parses the submitted value:
split on commas, trim, lowercase, drop empty strings, dedupe, save as
`blocked_sender_emails`. No format validation beyond that (matches the
`skills` field's lack of validation — an invalid entry is harmless, it just
never matches anything).

## Enforcement

In `src/app/api/cron/poll-mailboxes/route.ts`, both `pollMicrosoftCompany`
and `pollImapCompany` load `company.blocked_sender_emails` into a
`Set<string>` once per poll run (alongside the existing `agents`/
`aiProvider` setup), then add an early skip in their per-message loop,
checking the sender's lowercased email against the set — placed before
attachment fetching and AI classification (so blocked senders don't cost a
Graph attachment call or an AI classify call), mirroring the existing early
exit for Graph's `inferenceClassification === "other"`.

A new `skippedBlocked` counter is added next to the existing `skippedJunk`
in both functions' return shape and the overall poll summary.

`MailboxCompany` type and the `companies` select in the `GET` handler both
need `blocked_sender_emails` added.

## Out of scope

- Domain-wide / wildcard blocking.
- Blocking already-created tickets retroactively (list only affects future
  polls).
- Any UI surface other than the company settings form (no separate
  management page, no per-entry add/remove widget).
