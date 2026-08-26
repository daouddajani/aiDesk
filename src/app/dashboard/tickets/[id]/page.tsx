import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildAgentNameMap } from "@/lib/agentNames";
import { getInitials } from "@/lib/initials";
import { getAIProviderForCompany, type SuggestedAnswer } from "@/lib/ai";
import { formatDuration } from "@/lib/duration";
import { formatDateTime } from "@/lib/formatDate";
import { getCompanyTimezone } from "@/lib/companyTimezone";
import { TakeOwnershipButton } from "./TakeOwnershipButton";
import { ReassignTicketForm } from "./ReassignTicketForm";
import { CommentForm } from "./CommentForm";
import { CloseTicketForm } from "./CloseTicketForm";
import { ReopenTicketForm } from "./ReopenTicketForm";
import { ArchiveTicketForm } from "./ArchiveTicketForm";
import { AddReminderForm } from "./AddReminderForm";
import { TicketTimer } from "./TicketTimer";

const CARD_SHADOW =
  "shadow-card";

const STATUS_BADGE_CLASSES: Record<string, string> = {
  new: "bg-info-soft text-info",
  pending: "bg-warning-soft text-warning",
  on_process: "bg-primary-soft text-primary",
  closed: "bg-surface-alt text-ink-sub",
};

type Attachment = {
  id: string;
  filename: string;
  mime_type: string;
  size: number;
  storage_path: string;
};

async function signedUrlFor(
  supabase: Awaited<ReturnType<typeof createClient>>,
  path: string,
) {
  const { data } = await supabase.storage
    .from("attachments")
    .createSignedUrl(path, 3600);
  return data?.signedUrl ?? null;
}

function AttachmentPreview({
  filename,
  url,
  mimeType,
}: {
  filename: string;
  url: string | null;
  mimeType: string;
}) {
  if (!url) {
    return <>{filename}</>;
  }

  if (mimeType.startsWith("image/")) {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer">
        <img
          src={url}
          alt={filename}
          loading="lazy"
          className="max-h-48 rounded-lg border border-border object-contain"
        />
      </a>
    );
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="font-medium text-primary hover:underline"
    >
      {filename}
    </a>
  );
}

function MetaRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between py-2 text-[13px]">
      <span className="font-semibold text-ink-sub">{label}</span>
      <span className="text-ink">{children}</span>
    </div>
  );
}

type TimeEntry = {
  id: string;
  agent_id: string;
  started_at: string;
  ended_at: string | null;
};

// A currently-running entry (ended_at null) counts its elapsed time up to
// `now`. The caller's own running entry is ticked live client-side instead,
// so it's passed in as `excludeEntryId` to avoid double-counting.
function summarizeTimeEntries(
  entries: TimeEntry[],
  excludeEntryId: string | undefined,
  agentNameById: Map<string, string>,
  unnamedLabel: string,
) {
  const now = Date.now();
  const seconds = (entry: TimeEntry) => {
    const start = new Date(entry.started_at).getTime();
    const end = entry.ended_at ? new Date(entry.ended_at).getTime() : now;
    return Math.max(0, (end - start) / 1000);
  };

  const staticTotalSeconds = entries.reduce(
    (sum, entry) => (entry.id === excludeEntryId ? sum : sum + seconds(entry)),
    0,
  );

  const perAgentSeconds = new Map<string, number>();
  for (const entry of entries) {
    perAgentSeconds.set(
      entry.agent_id,
      (perAgentSeconds.get(entry.agent_id) ?? 0) + seconds(entry),
    );
  }
  const timeByAgent = [...perAgentSeconds.entries()]
    .map(([agentId, secs]) => ({
      agentId,
      name: agentNameById.get(agentId) ?? unnamedLabel,
      seconds: secs,
    }))
    .sort((a, b) => b.seconds - a.seconds);

  return { staticTotalSeconds, timeByAgent };
}

export default async function TicketDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const t = await getTranslations();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, company_id")
    .eq("id", user.id)
    .single();

  if (
    (profile?.role !== "company_admin" && profile?.role !== "company_agent") ||
    !profile.company_id
  ) {
    redirect("/login");
  }

  const { data: ticket } = await supabase
    .from("tickets")
    .select(
      "id, subject, sender_email, sender_name, description, status, assigned_agent_id, ai_suggested_agent_id, received_at, solution_text, archived_at",
    )
    .eq("id", id)
    .single();

  if (!ticket) {
    notFound();
  }

  let suggestedAnswers: SuggestedAnswer[] = [];
  if (ticket.status !== "closed") {
    try {
      const aiProvider = await getAIProviderForCompany(
        createAdminClient(),
        profile.company_id,
      );
      if (aiProvider) {
        suggestedAnswers = await aiProvider.suggestAnswer(
          supabase,
          profile.company_id,
          `${ticket.subject}\n\n${ticket.description}`,
          ticket.id,
        );
      }
    } catch {
      suggestedAnswers = [];
    }
  }

  const [
    { data: comments },
    { data: ticketAttachments },
    { data: agents },
    { data: assignmentLog },
    { data: timeEntries },
  ] = await Promise.all([
    supabase
      .from("ticket_comments")
      .select(
        "id, author_id, external_author_email, external_author_name, body, is_internal, created_at",
      )
      .eq("ticket_id", id)
      .order("created_at", { ascending: true }),
    supabase
      .from("attachments")
      .select("id, filename, mime_type, size, storage_path")
      .eq("ticket_id", id),
    supabase
      .from("profiles")
      .select("id, full_name, disabled")
      .eq("company_id", profile.company_id),
    supabase
      .from("ticket_assignment_log")
      .select("id, changed_by, previous_agent_id, new_agent_id, created_at")
      .eq("ticket_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("ticket_time_entries")
      .select("id, agent_id, started_at, ended_at")
      .eq("ticket_id", id),
  ]);

  const commentIds = (comments ?? []).map((c) => c.id);
  const { data: commentAttachments } = commentIds.length
    ? await supabase
        .from("attachments")
        .select("id, comment_id, filename, mime_type, size, storage_path")
        .in("comment_id", commentIds)
    : { data: [] as (Attachment & { comment_id: string })[] };

  const agentNameById = await buildAgentNameMap(agents ?? []);
  const timezone = await getCompanyTimezone(supabase, profile.company_id);

  const myRunningEntry = (timeEntries ?? []).find(
    (entry) => entry.agent_id === user.id && !entry.ended_at,
  );

  const { staticTotalSeconds, timeByAgent } = summarizeTimeEntries(
    timeEntries ?? [],
    myRunningEntry?.id,
    agentNameById,
    t("common.unnamed"),
  );

  const ticketAttachmentLinks = await Promise.all(
    (ticketAttachments ?? []).map(async (a) => ({
      ...a,
      url: await signedUrlFor(supabase, a.storage_path),
    })),
  );

  const commentAttachmentsByCommentId = new Map<
    string,
    { filename: string; url: string | null; mimeType: string }[]
  >();
  for (const a of commentAttachments ?? []) {
    const url = await signedUrlFor(supabase, a.storage_path);
    const list = commentAttachmentsByCommentId.get(a.comment_id) ?? [];
    list.push({ filename: a.filename, url, mimeType: a.mime_type });
    commentAttachmentsByCommentId.set(a.comment_id, list);
  }

  return (
    <div className="space-y-4">
      <Link
        href="/dashboard/tickets"
        className="inline-block text-[13.5px] font-bold text-ink-sub hover:text-ink"
      >
        ← {t("tickets.back")}
      </Link>

      <div className="grid items-start gap-5 lg:grid-cols-[1.7fr_1fr]">
        <div className={`rounded-2xl border border-border bg-surface p-6 ${CARD_SHADOW}`}>
          <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-[13px] text-ink-sub">
                {ticket.sender_email}
              </div>
              <h1 className="mt-1 text-[21px] font-extrabold text-ink">
                {ticket.subject}
              </h1>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {!ticket.archived_at && ticket.status !== "closed" && (
                <>
                  <TakeOwnershipButton
                    ticketId={ticket.id}
                    disabled={ticket.assigned_agent_id === user.id}
                  />
                  <CloseTicketForm ticketId={ticket.id} />
                  <AddReminderForm ticketId={ticket.id} />
                </>
              )}
              {!ticket.archived_at && ticket.status === "closed" && (
                <ReopenTicketForm ticketId={ticket.id} />
              )}
              {!ticket.archived_at && profile.role === "company_admin" && (
                <ArchiveTicketForm ticketId={ticket.id} />
              )}
            </div>
          </div>

          <div className="mb-5">
            <TicketTimer
              ticketId={ticket.id}
              isRunningForMe={Boolean(myRunningEntry)}
              runningStartedAt={myRunningEntry?.started_at ?? null}
              staticTotalSeconds={staticTotalSeconds}
              canStart={ticket.status !== "closed"}
            />
          </div>

          <div className="mb-6 rounded-xl bg-surface-alt p-4 text-[13.5px] leading-relaxed whitespace-pre-wrap text-ink">
            {ticket.description}
          </div>

          {ticketAttachmentLinks.length > 0 && (
            <div className="mb-6 space-y-1.5">
              <h2 className="text-[13px] font-bold text-ink-sub">
                {t("tickets.attachments")}
              </h2>
              <ul className="space-y-1 text-sm">
                {ticketAttachmentLinks.map((a) => (
                  <li key={a.id}>
                    <AttachmentPreview
                      filename={a.filename}
                      url={a.url}
                      mimeType={a.mime_type}
                    />
                  </li>
                ))}
              </ul>
            </div>
          )}

          {ticket.status === "closed" && ticket.solution_text && (
            <div className="mb-6 rounded-xl bg-success-soft p-4 text-[13.5px] text-ink">
              <span className="font-bold text-success">
                {t("tickets.solution")}{" "}
              </span>
              {ticket.solution_text}
            </div>
          )}

          <h2 className="mb-3.5 text-[13px] font-extrabold tracking-wide text-ink-sub uppercase">
            {t("tickets.activity")}
          </h2>
          <div className="space-y-4">
            {(comments ?? []).map((comment) => {
              const authorName = comment.author_id
                ? (agentNameById.get(comment.author_id) ?? t("common.unnamed"))
                : (comment.external_author_name ??
                  comment.external_author_email ??
                  ticket.sender_email);
              return (
                <div key={comment.id} className="flex gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] bg-ink-sub text-[11px] font-bold text-white">
                    {getInitials(authorName)}
                  </div>
                  <div
                    className={`flex-1 rounded-xl p-3.5 text-[13.5px] ${
                      comment.is_internal
                        ? "bg-warning-soft"
                        : "bg-surface-alt"
                    }`}
                  >
                    <div className="mb-1 flex flex-wrap items-center justify-between gap-2 text-xs text-ink-sub">
                      <span>
                        <b className="text-ink">{authorName}</b>
                        {comment.is_internal
                          ? ` · ${t("tickets.internalNoteTag")}`
                          : ""}
                      </span>
                      <span>
                        {formatDateTime(comment.created_at, timezone)}
                      </span>
                    </div>
                    <p className="leading-relaxed whitespace-pre-wrap text-ink">
                      {comment.body}
                    </p>
                    {commentAttachmentsByCommentId
                      .get(comment.id)
                      ?.map((a) => (
                        <div key={a.filename} className="mt-2 text-xs">
                          <AttachmentPreview
                            filename={a.filename}
                            url={a.url}
                            mimeType={a.mimeType}
                          />
                        </div>
                      ))}
                  </div>
                </div>
              );
            })}
            {(comments ?? []).length === 0 && (
              <p className="text-sm text-ink-sub">{t("tickets.noActivity")}</p>
            )}
          </div>

          <div className="mt-6">
            <CommentForm ticketId={ticket.id} />
          </div>
        </div>

        <div className="flex flex-col gap-5">
        <div className={`rounded-2xl border border-border bg-surface p-5 ${CARD_SHADOW}`}>
          <MetaRow label={t("dashboard.table.status")}>
            <span
              className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_BADGE_CLASSES[ticket.status]}`}
            >
              {t(`status.${ticket.status}`)}
            </span>
            {ticket.archived_at && (
              <span className="ms-2 inline-flex items-center rounded-full bg-danger-soft px-2.5 py-1 text-xs font-semibold text-danger">
                {t("tickets.archivedBadge")}
              </span>
            )}
          </MetaRow>
          <MetaRow label={t("dashboard.table.assignedTo")}>
            {ticket.assigned_agent_id
              ? (agentNameById.get(ticket.assigned_agent_id) ?? "—")
              : t("tickets.unassigned")}
          </MetaRow>
          {ticket.status !== "closed" && (
            <div className="pb-2">
              <ReassignTicketForm
                ticketId={ticket.id}
                currentAgentId={ticket.assigned_agent_id}
                agentOptions={(agents ?? [])
                  .filter((a) => !a.disabled)
                  .map((a) => ({
                    id: a.id,
                    name: agentNameById.get(a.id) ?? t("common.unnamed"),
                  }))}
              />
            </div>
          )}
          {!ticket.assigned_agent_id && ticket.ai_suggested_agent_id && (
            <MetaRow label={t("tickets.aiSuggestedAgent")}>
              {agentNameById.get(ticket.ai_suggested_agent_id) ?? "—"}
            </MetaRow>
          )}
          <div className="my-1.5 h-px bg-border" />
          <MetaRow label={t("dashboard.table.requester")}>
            {ticket.sender_name ?? ticket.sender_email}
          </MetaRow>
          <MetaRow label={t("dashboard.table.received")}>
            {formatDateTime(ticket.received_at, timezone)}
          </MetaRow>
        </div>

        {suggestedAnswers.length > 0 && (
          <div className={`rounded-2xl border border-border bg-surface p-5 ${CARD_SHADOW}`}>
            <h2 className="mb-3 text-[13px] font-extrabold tracking-wide text-ink-sub uppercase">
              {t("tickets.suggestedAnswers.title")}
            </h2>
            <div className="space-y-3">
              {suggestedAnswers.map((answer) => (
                <Link
                  key={answer.ticketId}
                  href={`/dashboard/tickets/${answer.ticketId}`}
                  className="block rounded-xl bg-surface-alt p-3 text-[12.5px] leading-relaxed hover:bg-border/40"
                >
                  <p className="font-semibold text-ink">{answer.subject}</p>
                  <p className="mt-1 text-[11px] font-bold tracking-wide text-ink-sub uppercase">
                    {t("tickets.suggestedAnswers.solutionLabel")}
                  </p>
                  <p className="line-clamp-2 whitespace-pre-wrap text-ink-sub">
                    {answer.solutionText}
                  </p>
                </Link>
              ))}
            </div>
          </div>
        )}

        {(assignmentLog ?? []).length > 0 && (
          <div className={`rounded-2xl border border-border bg-surface p-5 ${CARD_SHADOW}`}>
            <h2 className="mb-3 text-[13px] font-extrabold tracking-wide text-ink-sub uppercase">
              {t("tickets.assignmentHistory.title")}
            </h2>
            <div className="space-y-3">
              {(assignmentLog ?? []).map((entry) => (
                <div key={entry.id} className="text-[12.5px] leading-relaxed">
                  <p className="text-ink">
                    {t("tickets.assignmentHistory.entry", {
                      changedBy:
                        agentNameById.get(entry.changed_by) ??
                        t("common.unnamed"),
                      from: entry.previous_agent_id
                        ? (agentNameById.get(entry.previous_agent_id) ??
                          t("common.unnamed"))
                        : t("tickets.unassigned"),
                      to:
                        agentNameById.get(entry.new_agent_id) ??
                        t("common.unnamed"),
                    })}
                  </p>
                  <p className="text-ink-sub">
                    {formatDateTime(entry.created_at, timezone)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {timeByAgent.length > 0 && (
          <div className={`rounded-2xl border border-border bg-surface p-5 ${CARD_SHADOW}`}>
            <h2 className="mb-3 text-[13px] font-extrabold tracking-wide text-ink-sub uppercase">
              {t("tickets.timeDetails.title")}
            </h2>
            <div className="space-y-2">
              {timeByAgent.map((row) => (
                <div
                  key={row.agentId}
                  className="flex items-center justify-between text-[13px]"
                >
                  <span className="text-ink">{row.name}</span>
                  <span className="font-semibold text-ink-sub">
                    {formatDuration(row.seconds)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
        </div>
      </div>
    </div>
  );
}
