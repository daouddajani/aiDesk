You are building a **multi-tenant, AI-assisted IT help desk system**. Follow YAGNI strictly: build only what's specified below, prefer simple one-liner solutions over abstractions, and don't add configurability, plugins, or extra layers that aren't asked for — except the one abstraction explicitly requested (a pluggable AI provider interface).

## Tech stack

Next.js (App Router) + TypeScript + Tailwind CSS, Supabase (Postgres, Auth, Storage, RLS), deployed on Vercel. Use Supabase built-in features wherever possible instead of external services — no Redis, no third-party queues, no third-party auth.

## Roles & tenancy

Three roles, stored on a `profiles` table (1:1 with `auth.users`):

- **Super Admin** — global. Creates companies, invites a Company Admin per company. No ticket-content access needed by default.
- **Company Admin** — scoped to one `company_id`. Invites/manages agents, sets agent skills, configures the company's helpdesk mailbox connection and company info (name, logo, timezone, default fallback agent), can view/assign all tickets in their company.
- **Company Agent** — scoped to one `company_id`. Sees all tickets in their company, can take ownership, respond, comment, close tickets.

Enforce all of this with Postgres Row Level Security policies keyed on `company_id` and `role` — do not duplicate this logic in application code.

## Data model (minimum viable)

- `companies` (id, name, logo_url, timezone, helpdesk_email, default_agent_id, mailbox_provider_tokens — encrypted)
- `profiles` (id → auth.users, company_id nullable for super_admin, role enum, full_name, skills text[] or jsonb)
- `tickets` (id, company_id, subject, sender_email, sender_name, description, received_at, status enum, assigned_agent_id, priority — optional, ai_suggested_agent_id, solution_text)
- `ticket_comments` (id, ticket_id, author_id, body, is_internal boolean, created_at)
- `attachments` (id, ticket_id nullable, comment_id nullable, storage_path, filename, mime_type, size)

## Ticket status flow (clarifying your spec)

Your requirements listed `New, On Process, Pending, Closed` but also said "assignment → Pending" and "default agent sees it while unassigned." To remove the ambiguity, use this flow — adjust if you intended something else:

1. **New** — ticket just created from a non-junk email, assigned to the company's default fallback agent, visible to all agents in the company.
2. **Pending** — an agent has taken ownership (via dashboard or by replying from email) but hasn't started active work.
3. **On Process** — agent is actively working / has responded at least once.
4. **Closed** — agent provided a solution; `solution_text` is populated and feeds the AI knowledge base.

## Email ingestion (Microsoft 365 / Outlook)

- Each company connects its own mailbox via Microsoft Graph OAuth (Company Admin does this from the admin panel; store refresh tokens encrypted in Supabase).
- Poll the mailbox with a Vercel Cron job (e.g. every 1–2 minutes) calling Microsoft Graph's mail list/delta endpoint — simpler and more YAGNI than managing Graph webhook subscriptions (which expire every ~3 days and need renewal jobs). Only build webhook-based push if polling proves insufficient.
- For each new message: run junk detection first (see below). If junk, skip — no ticket. If not junk, create a ticket with subject, sender email, sender name (if present), body as description, received date, and pull attachments into Supabase Storage.
- Track the Graph `conversationId` on the ticket so agent replies sent from their own mailbox (detected on the next poll) can be matched back to the ticket, added as a comment, and trigger auto-assignment to the replying agent.

**Junk detection**: use Microsoft Graph's own `inferenceClassification` (Focused/Other) as the first signal. Only fall back to an AI call for ambiguous cases — don't run every email through the LLM if Graph already tells you it's junk.

## AI features (provider-agnostic)

Define a small `AIProvider` interface (e.g. `classify()`, `suggestAgent()`, `suggestAnswer()`, `embed()`) with one concrete OpenAI implementation to start. Keep the interface minimal — just the methods actually called — so a different provider can be swapped in later via env config without touching call sites.

1. **Classification** — categorize the problem from the email body.
2. **Agent suggestion** — match the classified problem against each agent's `skills` to suggest an assignee. Start with simple tag/keyword matching; only reach for embeddings-based similarity if keyword matching proves too weak.
3. **Suggested answers** — when a ticket is closed, its `solution_text` becomes training data for future suggestions. Use Postgres `pgvector` (Supabase extension) to embed closed-ticket problem+solution pairs and retrieve similar past solutions to suggest to agents on new tickets.

## Ticket handling & comments

- Agent can take ownership from the dashboard (assigns self, status → Pending) or by replying directly from email (same effect, detected on next mailbox poll).
- Agents add comments with an `is_internal` flag; internal comments stay in-app, external ones are emailed to the requester (reply in the same email thread). Comments can carry attachments.
- Closing a ticket requires `solution_text`.

## Agent dashboard

Per-agent view: tickets assigned to them (filterable by status), and basic performance stats — tickets closed, average resolution time, current open count.

## Auth

Supabase Auth, login-only — disable public sign-up in Supabase Auth settings. Admins create accounts via Supabase's `inviteUserByEmail`. Implement forgot-password with Supabase's built-in `resetPasswordForEmail` flow. No custom auth logic.

## Security & abuse prevention (built-in tools only, no external services)

- RLS policies for all tenant/role scoping (see above) — the database is the enforcement point, not just the UI.
- Validate and sanitize all input server-side (Server Actions / Route Handlers) before it touches the database.
- Restrict attachment mime types and size via Supabase Storage bucket policies.
- Rate limit sensitive endpoints (login, password reset, ticket comment creation) with a simple Postgres-backed sliding-window counter table + Next.js middleware — don't reach for Redis/Upstash.
- Use Next.js Server Actions (which have built-in CSRF protection) instead of hand-rolled API routes where practical.

## Design

Simple, modern UI, mobile-first and fully responsive. Don't over-build the design system — Tailwind defaults + a small shared component set is enough.

## Suggested additional features (optional — only build if there's time; don't let these creep into the MVP)

- Ticket priority (Low/Medium/High/Urgent), auto-set by the AI classifier
- SLA tracking (first-response / resolution targets) with breach alerts
- Canned responses / macros for agents
- Self-service knowledge base / FAQ page for requesters before they email in
- Duplicate-ticket detection (AI similarity check on new emails)
- Full-text search across tickets
- Audit log of status/assignment changes
- Email notifications to agents on assignment, to requesters on status change/reply
- Post-close CSAT survey emailed to the requester
- Tagging/labels on tickets
- Arabic/English handling in the AI classifier, given the sbitany.com domain
- Business-hours/holiday calendar for accurate SLA math
- CSV export of ticket data for Company Admins

## Build order

1. Supabase schema + RLS policies + Auth (invite-only, forgot password)
2. Super Admin: company + Company Admin management
3. Company Admin: agent management (with skills), mailbox connection, company settings
4. Mailbox polling → junk filter → ticket creation → attachments
5. Ticket dashboard (list/detail, status flow, comments, ownership)
6. Email-reply-to-ticket matching
7. AI provider interface + OpenAI implementation: classify, suggest agent, suggest answer
8. Agent performance dashboard
9. Only then: any of the optional features above, if time allows
