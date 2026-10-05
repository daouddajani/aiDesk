import { redirect } from "next/navigation";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { buildAgentNameMap } from "@/lib/agentNames";
import { formatDateTime } from "@/lib/formatDate";
import { getCompanyTimezone } from "@/lib/companyTimezone";
import {
  daysAgoLocalDateString,
  localDateStringToUtcISO,
  todayLocalDateString,
} from "@/lib/timezone";
import { resolvePagination } from "@/lib/pagination";
import { TicketPagination } from "@/components/TicketPagination";
import { SURVEY_FACES } from "@/lib/surveyFaces";

type SearchParams = {
  from?: string;
  to?: string;
  agent?: string;
  comments?: string;
  page?: string;
  pageSize?: string;
};

// Keeps .in() filters well under PostgREST's URL-length limit.
const IN_CHUNK = 200;

function chunk<T>(items: T[]) {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += IN_CHUNK) out.push(items.slice(i, i + IN_CHUNK));
  return out;
}

function buildHref(params: SearchParams) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) query.set(key, value);
  }
  const qs = query.toString();
  return qs ? `/dashboard/survey/results?${qs}` : "/dashboard/survey/results";
}

function average(ratings: number[]) {
  return ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : null;
}

function percentNegative(ratings: number[]) {
  return ratings.length
    ? Math.round((ratings.filter((r) => r <= 2).length / ratings.length) * 100)
    : null;
}

function Score({ value }: { value: number | null }) {
  if (value === null) return <span className="text-ink-sub">—</span>;
  return (
    <span className="whitespace-nowrap font-semibold text-ink">
      <span aria-hidden="true">{SURVEY_FACES[Math.round(value) - 1]}</span> {value.toFixed(1)}
    </span>
  );
}

const TH = "px-4 py-2.5 text-[11.5px] font-bold tracking-wide text-ink-sub uppercase";
const TD = "px-4 py-2.5";

export default async function SurveyResultsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const t = await getTranslations("surveyResults");
  const tAll = await getTranslations();
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

  if (profile?.role !== "company_admin" || !profile.company_id) {
    redirect("/dashboard");
  }

  const timezone = await getCompanyTimezone(supabase, profile.company_id);
  const from = params.from || daysAgoLocalDateString(timezone, 30);
  const to = params.to || todayLocalDateString(timezone);

  // Scoped to surveys *sent* in the period, so the response rate compares
  // like with like.
  const [{ data: sent }, { data: questions }, { data: agents }] = await Promise.all([
    supabase
      .from("survey_responses")
      .select("id, ticket_id, agent_id, submitted_at, comment")
      .eq("company_id", profile.company_id)
      .not("sent_at", "is", null)
      .gte("sent_at", localDateStringToUtcISO(from, timezone))
      .lte("sent_at", localDateStringToUtcISO(to, timezone, 23, 59, 59, 999))
      .order("submitted_at", { ascending: false, nullsFirst: false })
      .limit(5000),
    supabase
      .from("survey_questions")
      .select("id, text, position, archived_at")
      .eq("company_id", profile.company_id)
      .order("position", { ascending: true }),
    supabase
      .from("profiles")
      .select("id, full_name, disabled")
      .eq("company_id", profile.company_id),
  ]);

  const submitted = (sent ?? []).filter((r) => r.submitted_at);

  const answerChunks = await Promise.all(
    chunk(submitted.map((r) => r.id)).map((ids) =>
      supabase.from("survey_answers").select("response_id, question_id, rating").in("response_id", ids),
    ),
  );
  const answers = answerChunks.flatMap((c) => c.data ?? []);

  const agentNameById = await buildAgentNameMap(agents ?? []);

  const ratingsByResponse = new Map<string, number[]>();
  const ratingsByQuestion = new Map<string, number[]>();
  for (const a of answers) {
    ratingsByResponse.set(a.response_id, [...(ratingsByResponse.get(a.response_id) ?? []), a.rating]);
    ratingsByQuestion.set(a.question_id, [...(ratingsByQuestion.get(a.question_id) ?? []), a.rating]);
  }

  // KPIs
  const allRatings = answers.map((a) => a.rating);
  const responseRate = sent?.length
    ? Math.round((submitted.length / sent.length) * 100)
    : null;

  // By question — lowest average first, so problem areas surface at the top.
  // Archived questions only show if they still have answers in the period.
  const questionRows = (questions ?? [])
    .map((q) => {
      const ratings = ratingsByQuestion.get(q.id) ?? [];
      return {
        id: q.id,
        text: q.text,
        archived: Boolean(q.archived_at),
        ratings,
        avg: average(ratings),
        negative: percentNegative(ratings),
        counts: [1, 2, 3, 4, 5].map((n) => ratings.filter((r) => r === n).length),
      };
    })
    .filter((q) => !q.archived || q.ratings.length > 0)
    .sort((a, b) => (a.avg ?? 6) - (b.avg ?? 6));

  // By agent
  const agentRatings = new Map<string, { responses: number; ratings: number[] }>();
  for (const r of submitted) {
    const key = r.agent_id ?? "";
    const entry = agentRatings.get(key) ?? { responses: 0, ratings: [] };
    entry.responses += 1;
    entry.ratings.push(...(ratingsByResponse.get(r.id) ?? []));
    agentRatings.set(key, entry);
  }
  const agentRows = [...agentRatings.entries()]
    .map(([agentId, v]) => ({
      agentId,
      name: agentId ? (agentNameById.get(agentId) ?? t("unknownAgent")) : t("unassigned"),
      responses: v.responses,
      avg: average(v.ratings),
      negative: percentNegative(v.ratings),
    }))
    .sort((a, b) => (a.avg ?? 6) - (b.avg ?? 6));

  // Individual responses
  const filteredResponses = submitted.filter(
    (r) =>
      (!params.agent || (r.agent_id ?? "") === params.agent) &&
      (params.comments !== "1" || Boolean(r.comment)),
  );
  const { page, pageSize, totalPages, start, end } = resolvePagination(
    filteredResponses.length,
    params.page,
    params.pageSize,
  );
  const pageResponses = filteredResponses.slice(start, end);

  const { data: pageTickets } = pageResponses.length
    ? await supabase
        .from("tickets")
        .select("id, subject")
        .in("id", pageResponses.map((r) => r.ticket_id))
    : { data: [] };
  const subjectByTicket = new Map((pageTickets ?? []).map((tk) => [tk.id, tk.subject]));

  const kpis = [
    { label: t("kpi.sent"), value: String(sent?.length ?? 0) },
    { label: t("kpi.responses"), value: String(submitted.length) },
    { label: t("kpi.responseRate"), value: responseRate === null ? "—" : `${responseRate}%` },
    { label: t("kpi.average"), node: <Score value={average(allRatings)} /> },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-[22px] font-extrabold tracking-tight text-ink md:text-[27px]">
          {t("title")}
        </h1>
        <Link
          href="/dashboard/survey"
          className="rounded-[10px] border border-border bg-surface px-4 py-2 text-sm font-bold text-ink hover:bg-surface-alt"
        >
          {t("editSurvey")}
        </Link>
      </div>

      <form className="flex flex-wrap items-end gap-3 text-sm">
        <div className="space-y-1">
          <label htmlFor="from" className="text-xs font-semibold text-ink-sub">
            {tAll("dashboard.dateFrom")}
          </label>
          <input
            id="from"
            name="from"
            type="date"
            defaultValue={from}
            className="rounded-[10px] border border-border bg-surface px-2.5 py-1.5 text-sm text-ink"
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="to" className="text-xs font-semibold text-ink-sub">
            {tAll("dashboard.dateTo")}
          </label>
          <input
            id="to"
            name="to"
            type="date"
            defaultValue={to}
            className="rounded-[10px] border border-border bg-surface px-2.5 py-1.5 text-sm text-ink"
          />
        </div>
        <button
          type="submit"
          className="rounded-[10px] border border-border bg-surface px-4 py-2 text-sm font-bold text-ink hover:bg-surface-alt"
        >
          {t("apply")}
        </button>
      </form>
      <p className="text-xs text-ink-sub">{t("periodHint")}</p>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {kpis.map((k) => (
          <div key={k.label} className="rounded-2xl border border-border bg-surface p-4 shadow-card">
            <p className="text-xs font-semibold text-ink-sub">{k.label}</p>
            <p className="mt-1 text-xl font-extrabold text-ink">{k.node ?? k.value}</p>
          </div>
        ))}
      </div>

      <section className="space-y-2">
        <h2 className="text-base font-bold text-ink">{t("byQuestion.title")}</h2>
        <div className="rounded-2xl border border-border bg-surface shadow-card">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-start text-[13.5px]">
              <thead>
                <tr className="divide-x divide-border border-b border-border">
                  <th className={TH}>{t("byQuestion.question")}</th>
                  <th className={TH}>{t("average")}</th>
                  {SURVEY_FACES.map((face) => (
                    <th key={face} className={`${TH} text-center`}>
                      {face}
                    </th>
                  ))}
                  <th className={TH}>{t("negative")}</th>
                </tr>
              </thead>
              <tbody>
                {questionRows.map((q) => (
                  <tr key={q.id} className="divide-x divide-border border-b border-border last:border-0">
                    <td className={TD}>
                      {q.text}
                      {q.archived && (
                        <span className="ms-2 text-xs text-ink-sub">({t("byQuestion.deleted")})</span>
                      )}
                    </td>
                    <td className={TD}>
                      <Score value={q.avg} />
                    </td>
                    {q.counts.map((c, i) => (
                      <td key={i} className={`${TD} text-center`}>
                        {c}
                      </td>
                    ))}
                    <td className={`${TD} ${q.negative !== null && q.negative >= 30 ? "font-bold text-danger" : ""}`}>
                      {q.negative === null ? "—" : `${q.negative}%`}
                    </td>
                  </tr>
                ))}
                {questionRows.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-ink-sub">
                      {t("noData")}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-bold text-ink">{t("byAgent.title")}</h2>
        <div className="rounded-2xl border border-border bg-surface shadow-card">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-start text-[13.5px]">
              <thead>
                <tr className="divide-x divide-border border-b border-border">
                  <th className={TH}>{t("byAgent.agent")}</th>
                  <th className={TH}>{t("byAgent.responses")}</th>
                  <th className={TH}>{t("average")}</th>
                  <th className={TH}>{t("negative")}</th>
                </tr>
              </thead>
              <tbody>
                {agentRows.map((a) => (
                  <tr key={a.agentId} className="divide-x divide-border border-b border-border last:border-0">
                    <td className={TD}>
                      <Link
                        href={buildHref({ from: params.from, to: params.to, agent: a.agentId || undefined })}
                        className="font-medium text-ink hover:text-link-hover"
                      >
                        {a.name}
                      </Link>
                    </td>
                    <td className={TD}>{a.responses}</td>
                    <td className={TD}>
                      <Score value={a.avg} />
                    </td>
                    <td className={`${TD} ${a.negative !== null && a.negative >= 30 ? "font-bold text-danger" : ""}`}>
                      {a.negative === null ? "—" : `${a.negative}%`}
                    </td>
                  </tr>
                ))}
                {agentRows.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-ink-sub">
                      {t("noData")}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-bold text-ink">{t("responses.title")}</h2>
        <form className="flex flex-wrap items-end gap-3 text-sm">
          <input type="hidden" name="from" value={from} />
          <input type="hidden" name="to" value={to} />
          <div className="space-y-1">
            <label htmlFor="agent" className="text-xs font-semibold text-ink-sub">
              {t("byAgent.agent")}
            </label>
            <select
              id="agent"
              name="agent"
              defaultValue={params.agent ?? ""}
              className="rounded-[10px] border border-border bg-surface px-2.5 py-1.5 text-sm text-ink"
            >
              <option value="">{t("responses.allAgents")}</option>
              {agentRows
                .filter((a) => a.agentId)
                .map((a) => (
                  <option key={a.agentId} value={a.agentId}>
                    {a.name}
                  </option>
                ))}
            </select>
          </div>
          <label className="flex items-center gap-2 pb-1.5 text-sm text-ink">
            <input
              type="checkbox"
              name="comments"
              value="1"
              defaultChecked={params.comments === "1"}
              className="h-4 w-4 rounded border-border"
            />
            {t("responses.commentsOnly")}
          </label>
          <button
            type="submit"
            className="rounded-[10px] border border-border bg-surface px-4 py-2 text-sm font-bold text-ink hover:bg-surface-alt"
          >
            {t("apply")}
          </button>
        </form>
        <div className="rounded-2xl border border-border bg-surface shadow-card">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-start text-[13.5px]">
              <thead>
                <tr className="divide-x divide-border border-b border-border">
                  <th className={TH}>{t("responses.date")}</th>
                  <th className={TH}>{t("responses.ticket")}</th>
                  <th className={TH}>{t("byAgent.agent")}</th>
                  <th className={TH}>{t("average")}</th>
                  <th className={`${TH} w-[35%]`}>{t("responses.comment")}</th>
                </tr>
              </thead>
              <tbody>
                {pageResponses.map((r) => (
                  <tr key={r.id} className="divide-x divide-border border-b border-border last:border-0">
                    <td className={`${TD} whitespace-nowrap`}>
                      {formatDateTime(r.submitted_at!, timezone)}
                    </td>
                    <td className={TD}>
                      <Link
                        href={`/dashboard/tickets/${r.ticket_id}`}
                        className="font-medium text-ink hover:text-link-hover"
                      >
                        {subjectByTicket.get(r.ticket_id) ?? "—"}
                      </Link>
                    </td>
                    <td className={TD}>
                      {r.agent_id ? (agentNameById.get(r.agent_id) ?? t("unknownAgent")) : t("unassigned")}
                    </td>
                    <td className={TD}>
                      <Score value={average(ratingsByResponse.get(r.id) ?? [])} />
                    </td>
                    <td className={`${TD} whitespace-pre-wrap text-ink`}>
                      {r.comment ?? <span className="text-ink-sub">—</span>}
                    </td>
                  </tr>
                ))}
                {pageResponses.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-ink-sub">
                      {t("noData")}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <TicketPagination
            t={tAll}
            page={page}
            totalPages={totalPages}
            pageSize={pageSize}
            from={start + 1}
            to={end}
            total={filteredResponses.length}
            buildPageHref={(p) => buildHref({ ...params, page: String(p) })}
            buildPageSizeHref={(s) => buildHref({ ...params, pageSize: String(s), page: "1" })}
          />
        </div>
      </section>
    </div>
  );
}
