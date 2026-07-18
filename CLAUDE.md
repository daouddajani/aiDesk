# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project status

The Next.js app is scaffolded (TypeScript, Tailwind v4, App Router, `src/` dir, ESLint) with `@supabase/supabase-js` and `@supabase/ssr` installed. A Supabase project is provisioned and `.env.local` is populated; the schema exists in the database (`companies` — including a `company_ai_config jsonb` column for per-company AI provider settings — `profiles`, `tickets`, `ticket_comments`, `attachments`, `ticket_embeddings`, `rate_limits`, plus `current_user_role()`/`current_user_company_id()` RPCs and `pgvector`), though no local migration files for it exist in the repo yet.

Build order steps 1–8 are done. Auth (login, forgot-password, invite-acceptance via `/update-password` + `/auth/confirm`, role-based redirects); Super Admin company management (`/admin`); Company Admin agent management with skills (`/dashboard/agents`), mailbox connection for both Microsoft Graph OAuth and generic IMAP (`/dashboard/mailbox`), and company settings (`/dashboard/settings`); mailbox polling via `/api/cron/poll-mailboxes` → junk filter → ticket creation with attachments (`src/lib/ticketIngestion.ts`); ticket dashboard (`/dashboard/tickets`, list/detail, status flow, comments with attachments, ownership); email-reply-to-ticket matching (`src/lib/sendTicketReply.ts`, `graph_conversation_id`); the `AIProvider` interface (`classify()`, `suggestAgent()`, `suggestAnswer()`, `embed()`) wired into mailbox polling (junk fallback for IMAP, agent suggestion) and ticket closing (embeds `solution_text` into `ticket_embeddings`, surfaced as "Suggested past solutions" on the ticket detail page via the `match_ticket_embeddings` RPC); and the agent performance dashboard (`/dashboard/performance`). Not yet built: any of the optional features in `app.md` (ticket priority auto-set by AI, SLA tracking, canned responses, etc.) — none are in scope until explicitly requested. Treat `app.md` as the source of truth for all product and architecture decisions, and re-read it before starting any feature work.

The AI provider is per-company and BYOK (`src/lib/ai/`), configured by the Company Admin under `/dashboard/settings` (`AISettingsForm.tsx` + `updateAISettings` action): enable/disable toggle, provider choice (OpenAI / Anthropic / Gemini via `OpenAIProvider`/`AnthropicProvider`/`GeminiProvider`), and the company's own API key, stored encrypted in Supabase Vault (`companies.ai_secret_id`, mirroring the existing `mailbox_secret_id` pattern — `set_company_ai_secret`/`get_company_ai_secret`/`set_company_ai_embeddings_secret`/`get_company_ai_embeddings_secret` RPCs, service-role only). `getAIProviderForCompany(adminClient, companyId)` in `src/lib/ai/index.ts` is the single entry point every call site uses — it returns `null` (not an error) when AI is disabled or unconfigured, which callers treat as "skip AI" everywhere (mailbox poll, ticket close, ticket detail). Embeddings (and thus "suggested past solutions") always run on OpenAI regardless of the chosen chat provider — Anthropic has no embeddings API and Gemini's embedding dimension doesn't match the `ticket_embeddings` column, so Anthropic/Gemini companies need a second, separate OpenAI key (`companies.ai_embeddings_secret_id`) just for that one feature; it's optional and that feature silently stays off without it. Per-call token usage is logged to `ai_usage_log` (company-scoped RLS select policy) and surfaced as a monthly total in the settings page. `src/lib/supabase/admin.ts` is the service-role client for invite/`auth.users`/cron/secret-RPC operations — server-only.

Known follow-ups: pull the existing schema into local migrations (`supabase db pull` or equivalent) so it's tracked in the repo; the Supabase Auth project setting "Allow new users to sign up" is still enabled and needs to be turned off in the dashboard (no available tool/API does this) to satisfy `app.md`'s login-only requirement.

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
- **Company Agent** — scoped to one `company_id`; sees all company tickets, can take ownership, respond, comment, close.

### Data model

`companies`, `profiles`, `tickets`, `ticket_comments`, `attachments` — see `app.md` for exact columns. Key relationships: tickets belong to a company and an assigned agent; comments belong to tickets and have an `is_internal` flag controlling whether they're emailed to the requester; attachments can hang off either a ticket or a comment.

### Ticket status flow

`New` (created from non-junk email, auto-assigned to company's fallback agent) → `Pending` (agent took ownership, hasn't started) → `On Process` (agent actively working / has replied) → `Closed` (requires `solution_text`, which feeds the AI suggestion knowledge base). This flow was clarified from an ambiguous original spec — see `app.md` for the reasoning if it needs revisiting.

### Email ingestion pipeline (Microsoft 365 / Outlook)

Each company connects its own mailbox via Microsoft Graph OAuth (encrypted refresh tokens in Supabase). A Vercel Cron job polls Graph's mail list/delta endpoint every 1–2 minutes (deliberately not webhook subscriptions — those expire every ~3 days and need renewal jobs; only add webhooks if polling proves insufficient).

Per new message: run junk detection (Graph's `inferenceClassification` first; fall back to an AI call only for ambiguous cases) → if not junk, create a ticket with attachments pulled into Supabase Storage. The Graph `conversationId` is tracked on the ticket so agent replies sent from their own mailbox (detected on next poll) match back to the ticket as a comment and trigger auto-assignment to the replying agent.

### AI provider interface

A minimal `AIProvider` interface (`classify()`, `suggestAgent()`, `suggestAnswer()`, `embed()`) with one concrete OpenAI implementation — this is the single explicitly-sanctioned abstraction in the project. Keep it to only the methods actually called, so a different provider can later be swapped via env config without touching call sites.

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
