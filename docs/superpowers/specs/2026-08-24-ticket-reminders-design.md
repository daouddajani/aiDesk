# Ticket reminders — design

## Problem

Agents have no way to be reminded about a ticket at a specific future
moment — e.g. "follow up with this customer on Friday at 10am." Nothing in
the app tracks a personal, time-based follow-up tied to a ticket.

## Scope

From any open (not closed, not archived) ticket, an agent can set a
reminder: a date, a time, and a note. It's added to that agent's own
reminder list — not visible to other agents or admins. At the set moment,
the system emails the agent a reminder referencing the ticket and the note.
An agent can cancel (delete) a pending reminder before it fires. There is
no edit and no history view — once a reminder's email sends, it drops off
the list entirely.

## Storage

```sql
create table public.reminders (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies (id) on delete cascade,
  ticket_id uuid not null references tickets (id) on delete cascade,
  agent_id uuid not null references profiles (id) on delete cascade,
  remind_at timestamptz not null,
  comment text not null,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

create index reminders_agent_id_idx on reminders (agent_id);
create index reminders_ticket_id_idx on reminders (ticket_id);
create index reminders_pending_remind_at_idx on reminders (remind_at)
  where sent_at is null;

alter table reminders enable row level security;

create policy reminders_select on reminders
  for select to authenticated
  using (agent_id = auth.uid() and company_id = current_user_company_id());

create policy reminders_insert on reminders
  for insert to authenticated
  with check (agent_id = auth.uid() and company_id = current_user_company_id());

create policy reminders_delete on reminders
  for delete to authenticated
  using (agent_id = auth.uid() and company_id = current_user_company_id());
```

No update policy: the only field that ever changes post-insert is
`sent_at`, set exclusively by the dispatch cron via the service-role admin
client (bypasses RLS). Cancellation is delete-only.

No local migrations directory exists in this repo yet (schema currently
lives only in the remote Supabase project — see `CLAUDE.md`'s "known
follow-ups"). This SQL was run directly against the remote project via the
Supabase SQL editor rather than added as a tracked migration file,
consistent with how the rest of the schema got there.

`sent_at` does double duty: it's what marks a reminder as fired, and both
the dispatch query and the reminders list page filter on `sent_at is null`
— that's the entire mechanism behind "a fired reminder drops off the list,"
no separate history table needed.

## Server actions

`addReminder` (`src/app/dashboard/tickets/actions.ts`) — validates the
ticket belongs to the caller's company and isn't closed/archived, converts
the submitted date+time to a UTC instant via the company's timezone
(`getCompanyTimezone` + `localDateStringToUtcISO`, same helpers the ticket
list/detail pages already use), rejects a non-future time, inserts the row.

`deleteReminder` (`src/app/dashboard/reminders/actions.ts`) — deletes a
reminder scoped to the caller's own `agent_id`/`company_id` (redundant with
RLS, kept for defense-in-depth, matching this codebase's existing style).

## UI

`AddReminderForm.tsx` — a dialog on the ticket detail page's action row
(next to "Close ticket"), shown under the same condition as
`CloseTicketForm` (`!archived_at && status !== "closed"`). Fields: date,
time, note.

`/dashboard/reminders` — a personal, unpaginated list of the signed-in
agent's own pending reminders (`sent_at is null`), sorted by `remind_at`
ascending, each row linking to its ticket with a delete button
(`DeleteReminderButton.tsx`). Visible to both `company_admin` and
`company_agent` roles equally — it's personal, not a management view. New
shared nav item ("Reminders") between Performance and the admin-only block.

## Dispatch

`/api/cron/dispatch-reminders/route.ts`, mirroring
`poll-mailboxes/route.ts`'s shape (same `CRON_SECRET` bearer-token auth,
service-role admin client, per-item try/catch, JSON results summary). Every
minute (`vercel.json`), it selects reminders with `sent_at is null` and
`remind_at <= now()`, resolves each agent's email via
`auth.admin.listUsers()` (same lookup pattern as `loadAgentEmailMap()` in
`poll-mailboxes/route.ts`), sends via the existing global Resend account
(`src/lib/resend.ts` — already used for invite/password-reset emails, no
per-company mailbox needed), and stamps `sent_at` on success.

## Out of scope

- Editing a reminder's date/time/note after creation (cancel-and-recreate
  covers it).
- Admin or cross-agent visibility into reminders.
- A history view of already-sent reminders.
- Recurring/repeating reminders.
- Any reminder concept not tied to a ticket.
