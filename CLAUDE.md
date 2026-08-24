# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project status

The Next.js app is scaffolded (TypeScript, Tailwind v4, App Router, `src/` dir, ESLint) with `@supabase/supabase-js` and `@supabase/ssr` installed. A Supabase project is provisioned and `.env.local` is populated; the schema exists in the database (`companies` — including a `company_ai_config jsonb` column for per-company AI provider settings — `profiles`, `tickets`, `ticket_comments`, `attachments`, `ticket_embeddings`, `rate_limits`, plus `current_user_role()`/`current_user_company_id()` RPCs and `pgvector`), though no local migration files for it exist in the repo yet.

Build order steps 1–8 are done. Auth (login, forgot-password, invite-acceptance via `/update-password` + `/auth/confirm`, role-based redirects); Super Admin company management (`/admin`); Company Admin agent management with skills (`/dashboard/agents`), mailbox connection for both Microsoft Graph OAuth and generic IMAP (`/dashboard/mailbox`), and company settings (`/dashboard/settings`); mailbox polling via `/api/cron/poll-mailboxes` → junk filter → ticket creation with attachments (`src/lib/ticketIngestion.ts`); ticket dashboard (`/dashboard/tickets`, list/detail, status flow, comments with attachments, ownership); email-reply-to-ticket matching (`ingestIncomingEmail()` in `src/lib/ticketIngestion.ts`, matched by `graph_conversation_id` on Microsoft or the In-Reply-To/References header chain on IMAP — see the "Beyond app.md" bullet below for what this actually does); the `AIProvider` interface (`classify()`, `suggestAgent()`, `suggestAnswer()`, `embed()`) wired into mailbox polling (junk fallback for IMAP, agent suggestion) and ticket closing (embeds `solution_text` into `ticket_embeddings`, surfaced as "Suggested past solutions" on the ticket detail page via the `match_ticket_embeddings` RPC); and the agent performance dashboard (`/dashboard/performance`). Not yet built: any of the optional features in `app.md` (ticket priority auto-set by AI, SLA tracking, canned responses, etc.) — none are in scope until explicitly requested. Treat `app.md` as the source of truth for all product and architecture decisions, and re-read it before starting any feature work.

The AI provider is per-company and BYOK (`src/lib/ai/`), configured by the Company Admin under `/dashboard/settings` (`AISettingsForm.tsx` + `updateAISettings` action): enable/disable toggle, provider choice (OpenAI / Anthropic / Gemini via `OpenAIProvider`/`AnthropicProvider`/`GeminiProvider`), and the company's own API key, stored encrypted in Supabase Vault (`companies.ai_secret_id`, mirroring the existing `mailbox_secret_id` pattern — `set_company_ai_secret`/`get_company_ai_secret`/`set_company_ai_embeddings_secret`/`get_company_ai_embeddings_secret` RPCs, service-role only). `getAIProviderForCompany(adminClient, companyId)` in `src/lib/ai/index.ts` is the single entry point every call site uses — it returns `null` (not an error) when AI is disabled or unconfigured, which callers treat as "skip AI" everywhere (mailbox poll, ticket close, ticket detail). Embeddings (and thus "suggested past solutions") always run on OpenAI regardless of the chosen chat provider — Anthropic has no embeddings API and Gemini's embedding dimension doesn't match the `ticket_embeddings` column, so Anthropic/Gemini companies need a second, separate OpenAI key (`companies.ai_embeddings_secret_id`) just for that one feature; it's optional and that feature silently stays off without it. Per-call token usage is logged to `ai_usage_log` (company-scoped RLS select policy) and surfaced as a monthly total in the settings page. `src/lib/supabase/admin.ts` is the service-role client for invite/`auth.users`/cron/secret-RPC operations — server-only.

Beyond app.md's original spec, the following were built on direct user request (all Steps 1–8 features already existed; these are additions on top):

- **Live in-app ticket notifications** — `src/components/shell/TicketNotifications.tsx`, mounted in `AppShell` for `/dashboard/*` only (not `/admin`, not `/profile`). Subscribes to Supabase Realtime `postgres_changes` INSERT events on `tickets`, filtered to the signed-in user's `company_id`; delivery is gated by the existing `tickets_select` RLS policy, not app code. The `tickets` table had to be explicitly added to the `supabase_realtime` publication (`alter publication supabase_realtime add table public.tickets`) — new tables aren't in it by default. **Gotcha**: the effect must `await supabase.auth.getSession()` before calling `.channel().subscribe()` — `@supabase/ssr`'s browser client hydrates the session asynchronously and calls `realtime.setAuth()` on an auth-state-change listener, so subscribing immediately on mount races ahead of that and joins the channel unauthenticated (looks "SUBSCRIBED" but silently receives nothing).
- **Ticket reassignment** — any company_admin/company_agent can reassign a ticket to any other agent in the company (`ReassignTicketForm.tsx` + `reassignTicket` action), not just self-assign via "Take ownership". Both flow through a shared `assignTicket()` helper in `tickets/actions.ts` that also blocks assignment on closed tickets and logs every real change (not no-ops) to `ticket_assignment_log` (`changed_by`, `previous_agent_id`, `new_agent_id`), rendered as an "Assignment history" card on the ticket detail page.
- **Per-ticket time tracking** — `ticket_time_entries` (`agent_id`, `started_at`, `ended_at` nullable while running), RLS-scoped so agents can only start/stop their own entries. `TicketTimer.tsx` shows a live-ticking total in the ticket header (client-side `setInterval`, seeded from the server-computed total) plus a Start/Stop toggle; a "Time details" card breaks total time down per agent. Starting a new timer auto-stops any other ticket's timer the same agent left running — one agent, one active session at a time. `src/lib/duration.ts` (`formatDuration`) is the shared seconds→"Xd Xh"/"Xh Xm"/"Xm Xs" formatter, reused for both timer display and average-resolution-time KPIs.
- **Closed-ticket restrictions + reopen** — closed tickets block "Take ownership", reassignment, and starting a new timer, enforced both in the UI (buttons hidden) and inside the actions themselves (`assignTicket`/`startTimer` check status server-side — the UI hiding isn't the security boundary). Stopping an already-running timer stays allowed regardless of status, so a session left running when a ticket closes isn't stranded. A closed ticket instead shows "Reopen ticket" (`ReopenTicketForm.tsx`, dialog pattern matching `CloseTicketForm.tsx`), which requires a reason and logs it as an internal `ticket_comments` entry (`is_internal: true`, not emailed to the requester) so it shows up in the existing Activity feed rather than a separate audit table.
- **Tickets list filters** (`/dashboard/tickets`) — agents default to "My tickets" (assigned to them only), admins default to "All tickets", either can toggle (`?mine=me` / `?mine=all`). Status tabs show live counts scoped to the mine/date filters but not the active tab, so switching tabs doesn't change the other tabs' numbers. A from/to date range (default: 15 days ago through today) filters `received_at` at the Supabase query level, not client-side.
- **Agent performance KPIs** — "Avg. resolution time" (`closed_at - received_at`, averaged over an agent's closed tickets) added to `/dashboard/performance` for both the agent's own view and the admin's per-agent table. This KPI wasn't computed anywhere before despite being in app.md's original per-agent stats list. It lives on the Performance page, not the `/dashboard` landing page — that was tried first and explicitly moved here.
- **Ticket reminders** — from any open (not closed, not archived) ticket, an agent can set a personal reminder (date, time, note) via `AddReminderForm.tsx` on the ticket detail action row, backed by a `reminders` table (`company_id`, `ticket_id`, `agent_id`, `remind_at`, `comment`, `sent_at`) RLS-scoped so only the creating agent can see/insert/delete their own rows — not visible to other agents or admins. They show up on a personal, unpaginated `/dashboard/reminders` list (both roles, sorted by `remind_at`), with a delete button to cancel before it fires; there's no edit and no history — once sent, `sent_at` is stamped and the row drops off the list. `/api/cron/dispatch-reminders` (new `vercel.json` entry, every minute) mirrors `poll-mailboxes`'s auth/admin-client/per-item-try-catch shape, sends the reminder email via the existing global Resend account (`src/lib/resend.ts`, same one used for invite/password-reset emails — no per-company mailbox needed), and stamps `sent_at` on success. See `docs/superpowers/specs/2026-08-24-ticket-reminders-design.md` for the full design.
- **Quoted-reply stripping** — `stripQuotedReply()` in `src/lib/emailQuote.ts`, applied in `classifyForTicket()` (`poll-mailboxes/route.ts`) to every inbound message before the AI ever sees it, so it works even when AI is disabled for the company. Cuts the body at the first line matching a Gmail/Apple "On ... wrote:", an Outlook "From:/Sent:/To:/Subject:" quoted-header block, a "-----Original/Forwarded Message-----" separator, or a "> " quoted line — leaving only the sender's actual new text. Required fixing `stripHtml()` (`src/lib/htmlText.ts`) first: it used to collapse all whitespace including newlines, flattening an entire HTML email into one line and destroying the line boundaries this detection depends on — it now turns `<br>`/`<p>`/`<div>`/etc. closes into `\n` before stripping tags. This runs upstream of (and independently from) the AI's `cleanBody`, which only ever strips signature blocks, not quote chains — the two are complementary, not redundant.
- **Reply-to-existing-ticket matching, including customer replies** — `ingestIncomingEmail()` in `src/lib/ticketIngestion.ts` is what mailbox polling actually calls now (not `createTicketFromEmail()` directly). It looks for a ticket already on the same thread — `graph_conversation_id` on Microsoft, or the incoming message's In-Reply-To/References headers matched against tickets' `source_message_id` on IMAP (`ParsedIncomingMessage.threadRefs` in `src/lib/imapPoll.ts`) — and if found, appends the message as a `ticket_comments` row instead of creating a new ticket; falls back to `createTicketFromEmail()` only when no match exists. app.md (line 39/100) only specified this for an agent replying from their own mailbox (detected via a company-agent email lookup built from `auth.admin.listUsers()`, keyed to `assigned_agent_id`/status auto-advance same as `assignTicket()`+external-comment-reply combined) — matching customer replies too was a direct user request beyond that spec, and required a migration: `ticket_comments.author_id` is now nullable, with `external_author_email`/`external_author_name` populated instead when the reply isn't from a known agent (rendered in the ticket detail Activity feed via `comment.author_id ? agentName : external_author_name/email`). A `ticket_comments.source_message_id` column (unique per ticket, mirroring the existing per-company dedup on `tickets.source_message_id`) prevents the same reply being appended twice across polls.
- **Styling convention**: every data table has `divide-x divide-border` on both its `<thead>` and `<tbody>` `<tr>` elements for vertical column dividers — keep this on any new table.

Known follow-ups: pull the existing schema into local migrations (`supabase db pull` or equivalent) so it's tracked in the repo — a lot of schema (AI columns, `ticket_assignment_log`, `ticket_time_entries`, `ai_usage_log`, the `tickets` realtime publication membership) exists only in the remote DB with nothing in the repo to reproduce it from scratch; the Supabase Auth project setting "Allow new users to sign up" is still enabled and needs to be turned off in the dashboard (no available tool/API does this) to satisfy `app.md`'s login-only requirement; the repo is now on GitHub (`https://github.com/daouddajani/aiDesk`, `main` branch) but **still not linked/deployed to Vercel** — `vercel.json`'s cron schedule for `/api/cron/poll-mailboxes` has never actually run automatically anywhere, so the mailbox only gets polled when manually triggered (`curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/poll-mailboxes`).

## Commands

- `npm run dev` — start the dev server (Turbopack)
- `npm run build` — production build
- `npm run start` — run the production build
- `npm run lint` — ESLint (flat config, `eslint.config.mjs`)

No test runner is configured yet — add one when the first feature needs tests.

## Supabase client usage

Three entry points under `src/lib/supabase/`, following the standard `@supabase/ssr` split:

- `client.ts` — `createClient()` for Client Components (browser).
- `server.ts` — `createClient()` (async) for Server Components / Server Actions / Route Handlers.
- `middleware.ts` — `updateSession()`, called from `src/middleware.ts` on every request to keep the auth cookie fresh.

Note: Next.js 16 nudges toward renaming root `middleware.ts` to `proxy.ts`, but `proxy.ts` is explicitly documented as **not** for auth/session logic (it's for Node-API-heavy network-boundary concerns). The session-refresh cookie logic here is exactly the auth defense-in-depth case `middleware.ts` is still meant for, so it's intentionally kept as `middleware.ts` despite the build-time deprecation warning.

## Core constraint: YAGNI

`app.md` explicitly mandates strict YAGNI. Build only what's specified, prefer simple one-liner solutions over abstractions, and don't add configurability/plugins/extra layers beyond what's asked for. The **one exception** is the pluggable `AIProvider` interface, which is explicitly requested — see below.

## Tech stack

Next.js (App Router) + TypeScript + Tailwind CSS, Supabase (Postgres, Auth, Storage, RLS), deployed on Vercel. Prefer Supabase built-in features over external services — no Redis, no third-party queues, no third-party auth.

## Architecture overview

### Multi-tenancy & roles

Tenancy is enforced entirely through Postgres **Row Level Security**, keyed on `company_id` and `role` — this logic must not be duplicated in application code. Three roles live on a `profiles` table (1:1 with `auth.users`):

- **Super Admin** — global; creates companies and invites Company Admins; no ticket-content access by default.
- **Company Admin** — scoped to one `company_id`; manages agents/skills, mailbox connection, company settings; can view/assign all tickets in their company.
- **Company Agent** — scoped to one `company_id`; sees all company tickets, can take ownership, reassign, respond, comment, track time, close/reopen.

### Data model

`companies`, `profiles`, `tickets`, `ticket_comments`, `attachments` — see `app.md` for exact columns. Key relationships: tickets belong to a company and an assigned agent; comments belong to tickets and have an `is_internal` flag controlling whether they're emailed to the requester; attachments can hang off either a ticket or a comment.

### Ticket status flow

`New` (created from non-junk email, auto-assigned to company's fallback agent) → `Pending` (agent took ownership, hasn't started) → `On Process` (agent actively working / has replied) → `Closed` (requires `solution_text`, which feeds the AI suggestion knowledge base). This flow was clarified from an ambiguous original spec — see `app.md` for the reasoning if it needs revisiting.

### Email ingestion pipeline (Microsoft 365 / Outlook)

Each company connects its own mailbox via Microsoft Graph OAuth (encrypted refresh tokens in Supabase). A Vercel Cron job polls Graph's mail list/delta endpoint every 1–2 minutes (deliberately not webhook subscriptions — those expire every ~3 days and need renewal jobs; only add webhooks if polling proves insufficient).

Per new message: run junk detection (Graph's `inferenceClassification` first; fall back to an AI call only for ambiguous cases) → if not junk, create a ticket with attachments pulled into Supabase Storage. The Graph `conversationId` is tracked on the ticket so agent replies sent from their own mailbox (detected on next poll) match back to the ticket as a comment and trigger auto-assignment to the replying agent.

### AI provider interface

A minimal `AIProvider` interface (`classify()`, `suggestAgent()`, `suggestAnswer()`, `embed()`) — this is the single explicitly-sanctioned abstraction in the project. Keep it to only the methods actually called. It now has three implementations (OpenAI, Anthropic, Gemini), selected per-company via BYOK settings rather than env config — see "Project status" above for the full picture (embeddings-provider constraint, secret storage, usage logging).

- **Classification**: categorize the problem from the email body.
- **Agent suggestion**: match classification against agent `skills` — start with keyword/tag matching, only move to embeddings-based similarity if that proves too weak.
- **Suggested answers**: use Supabase `pgvector` to embed closed-ticket problem+solution pairs and retrieve similar past solutions for new tickets.

### Auth

Supabase Auth, login-only (public sign-up disabled). Admins create accounts via `inviteUserByEmail`; forgot-password uses Supabase's built-in `resetPasswordForEmail`. No custom auth logic.

### Security model

RLS is the enforcement point for all tenant/role scoping — not the UI. All input is validated/sanitized server-side (Server Actions / Route Handlers) before touching the database. Attachment mime types/size are restricted via Supabase Storage bucket policies. Rate limiting (login, password reset, comment creation) uses a Postgres-backed sliding-window counter table + Next.js middleware, not Redis/Upstash. Prefer Next.js Server Actions (built-in CSRF protection) over hand-rolled API routes.

## Build order

Follow this sequence (from `app.md`) rather than jumping ahead to optional features:

1. Supabase schema + RLS policies + Auth
2. Super Admin: company + Company Admin management
3. Company Admin: agent management, mailbox connection, company settings
4. Mailbox polling → junk filter → ticket creation → attachments
5. Ticket dashboard (list/detail, status flow, comments, ownership)
6. Email-reply-to-ticket matching
7. AI provider interface + OpenAI implementation
8. Agent performance dashboard
9. Optional features (see `app.md`'s "Suggested additional features" list) only if time allows — do not let these creep into the MVP.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
