import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildAgentNameMap } from "@/lib/agentNames";
import { getInitials } from "@/lib/initials";
import { getAIProviderForCompany, type SuggestedAnswer } from "@/lib/ai";
import { TakeOwnershipButton } from "./TakeOwnershipButton";
import { CommentForm } from "./CommentForm";
import { CloseTicketForm } from "./CloseTicketForm";

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
      "id, subject, sender_email, sender_name, description, status, assigned_agent_id, ai_suggested_agent_id, received_at, solution_text",
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
          ticket.description,
          ticket.id,
        );
      }
    } catch {
      suggestedAnswers = [];
    }
  }

  const [{ data: comments }, { data: ticketAttachments }, { data: agents }] =
    await Promise.all([
      supabase
        .from("ticket_comments")
        .select("id, author_id, body, is_internal, created_at")
        .eq("ticket_id", id)
        .order("created_at", { ascending: true }),
      supabase
        .from("attachments")
        .select("id, filename, mime_type, size, storage_path")
        .eq("ticket_id", id),
      supabase
        .from("profiles")
        .select("id, full_name")
        .eq("company_id", profile.company_id),
    ]);

  const commentIds = (comments ?? []).map((c) => c.id);
  const { data: commentAttachments } = commentIds.length
    ? await supabase
        .from("attachments")
        .select("id, comment_id, filename, mime_type, size, storage_path")
        .in("comment_id", commentIds)
    : { data: [] as (Attachment & { comment_id: string })[] };

  const agentNameById = await buildAgentNameMap(agents ?? []);

  const ticketAttachmentLinks = await Promise.all(
    (ticketAttachments ?? []).map(async (a) => ({
      ...a,
      url: await signedUrlFor(supabase, a.storage_path),
    })),
  );

  const commentAttachmentsByCommentId = new Map<
    string,
    { filename: string; url: string | null }[]
  >();
  for (const a of commentAttachments ?? []) {
    const url = await signedUrlFor(supabase, a.storage_path);
    const list = commentAttachmentsByCommentId.get(a.comment_id) ?? [];
    list.push({ filename: a.filename, url });
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
              <TakeOwnershipButton ticketId={ticket.id} />
              {ticket.status !== "closed" && (
                <CloseTicketForm ticketId={ticket.id} />
              )}
            </div>
          </div>

          <div className="mb-6 rounded-xl bg-surface-alt p-4 text-[13.5px] leading-relaxed whitespace-pre-wrap text-ink">
            {ticket.description}
          </div>

          {ticketAttachmentLinks.length > 0 && (
            <div className="mb-6 space-y-1.5">
              <h3 className="text-[13px] font-bold text-ink-sub">
                {t("tickets.attachments")}
              </h3>
              <ul className="space-y-1 text-sm">
                {ticketAttachmentLinks.map((a) => (
                  <li key={a.id}>
                    {a.url ? (
                      <a
                        href={a.url}
                        className="font-medium text-primary hover:underline"
                      >
                        {a.filename}
                      </a>
                    ) : (
                      a.filename
                    )}
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

          <h3 className="mb-3.5 text-[13px] font-extrabold tracking-wide text-ink-sub uppercase">
            {t("tickets.activity")}
          </h3>
          <div className="space-y-4">
            {(comments ?? []).map((comment) => {
              const authorName =
                agentNameById.get(comment.author_id) ?? t("common.unnamed");
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
                        {new Date(comment.created_at).toLocaleString()}
                      </span>
                    </div>
                    <p className="leading-relaxed whitespace-pre-wrap text-ink">
                      {comment.body}
                    </p>
                    {commentAttachmentsByCommentId
                      .get(comment.id)
                      ?.map((a) => (
                        <div key={a.filename} className="mt-2 text-xs">
                          {a.url ? (
                            <a
                              href={a.url}
                              className="font-medium text-primary hover:underline"
                            >
                              {a.filename}
                            </a>
                          ) : (
                            a.filename
                          )}
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

        <div className={`rounded-2xl border border-border bg-surface p-5 ${CARD_SHADOW}`}>
          <MetaRow label={t("dashboard.table.status")}>
            <span
              className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_BADGE_CLASSES[ticket.status]}`}
            >
              {t(`status.${ticket.status}`)}
            </span>
          </MetaRow>
          <MetaRow label={t("dashboard.table.assignedTo")}>
            {ticket.assigned_agent_id
              ? (agentNameById.get(ticket.assigned_agent_id) ?? "—")
              : t("tickets.unassigned")}
          </MetaRow>
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
            {new Date(ticket.received_at).toLocaleString()}
          </MetaRow>
        </div>

        {suggestedAnswers.length > 0 && (
          <div
            className={`rounded-2xl border border-border bg-surface p-5 lg:col-start-2 ${CARD_SHADOW}`}
          >
            <h3 className="mb-3 text-[13px] font-extrabold tracking-wide text-ink-sub uppercase">
              {t("tickets.suggestedAnswers.title")}
            </h3>
            <div className="space-y-3">
              {suggestedAnswers.map((answer) => (
                <Link
                  key={answer.ticketId}
                  href={`/dashboard/tickets/${answer.ticketId}`}
                  className="block rounded-xl bg-surface-alt p-3 text-[12.5px] leading-relaxed text-ink hover:bg-border/40"
                >
                  <p className="line-clamp-3 whitespace-pre-wrap">
                    {answer.content}
                  </p>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
