import { redirect } from "next/navigation";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { buildAgentNameMap } from "@/lib/agentNames";
import { formatDuration } from "@/lib/duration";
import { formatDate } from "@/lib/formatDate";
import { getCompanyTimezone } from "@/lib/companyTimezone";
import { toLocalDateString } from "@/lib/timezone";
import { resolvePagination } from "@/lib/pagination";
import { TicketPagination } from "@/components/TicketPagination";
import { DateRangeFilter, buildHref } from "@/components/DateRangeFilter";

type Translator = Awaited<ReturnType<typeof getTranslations>>;

const STATUS_BADGE_CLASSES: Record<string, string> = {
  new: "bg-info-soft text-info",
  pending: "bg-warning-soft text-warning",
  on_process: "bg-primary-soft text-primary",
  closed: "bg-surface-alt text-ink-sub",
};

type TicketRow = {
  id: string;
  subject: string;
  status: string;
  assigned_agent_id: string | null;
  received_at: string;
  closed_at: string | null;
};

// The "relevant date" for a ticket depends on its state: a closed ticket is
// dated by when it closed, everything else by when it came in.
function relevantDate(ticket: TicketRow) {
  return ticket.status === "closed" && ticket.closed_at
    ? ticket.closed_at
    : ticket.received_at;
}

function withinRange(
  dateStr: string,
  timeZone: string,
  from?: string,
  to?: string,
) {
  const date = toLocalDateString(dateStr, timeZone);
  if (from && date < from) return false;
  if (to && date > to) return false;
  return true;
}

// Average of (closed_at - received_at) over closed tickets that have both
// dates — null (rendered as "—") when there's nothing closed yet.
function averageResolutionSeconds(tickets: TicketRow[]): number | null {
  const seconds = tickets
    .filter((t) => t.status === "closed" && t.closed_at)
    .map(
      (t) =>
        (new Date(t.closed_at!).getTime() - new Date(t.received_at).getTime()) /
        1000,
    );
  return seconds.length
    ? seconds.reduce((a, b) => a + b, 0) / seconds.length
    : null;
}

const STAT_CARD_THEMES = {
  neutral: { icon: "bg-surface-alt text-ink-sub", ring: "ring-ink" },
  blue: { icon: "bg-info-soft text-info", ring: "ring-info" },
  green: { icon: "bg-success-soft text-success", ring: "ring-success" },
} as const;

function StatCard({
  label,
  value,
  href,
  active,
  theme,
  icon,
}: {
  label: string;
  value: number;
  href: string;
  active: boolean;
  theme: keyof typeof STAT_CARD_THEMES;
  icon: React.ReactNode;
}) {
  const colors = STAT_CARD_THEMES[theme];

  return (
    <Link
      href={href}
      className={`flex items-center gap-4 rounded-2xl border p-4 transition-colors ${
        active
          ? `border-transparent bg-surface shadow-card ring-2 ${colors.ring}`
          : "border-border bg-surface hover:bg-surface-alt"
      }`}
    >
      <span
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${colors.icon}`}
      >
        {icon}
      </span>
      <span>
        <span className="block text-xs text-ink-sub">{label}</span>
        <span className="block text-2xl font-extrabold text-ink">{value}</span>
      </span>
    </Link>
  );
}

const TOTAL_ICON = (
  <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
    <path d="M4 4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V4Zm2 2v2h8V6H6Zm0 4v2h8v-2H6Zm0 4v2h5v-2H6Z" />
  </svg>
);
const OPEN_ICON = (
  <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
    <path
      fillRule="evenodd"
      d="M10 2a8 8 0 1 0 0 16 8 8 0 0 0 0-16Zm1 4a1 1 0 1 0-2 0v4c0 .27.1.52.3.7l2.5 2.5a1 1 0 0 0 1.4-1.4L11 9.6V6Z"
      clipRule="evenodd"
    />
  </svg>
);
const CLOSED_ICON = (
  <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
    <path
      fillRule="evenodd"
      d="M16.7 5.3a1 1 0 0 1 0 1.4l-7.5 7.5a1 1 0 0 1-1.4 0l-3.5-3.5a1 1 0 1 1 1.4-1.4L8.5 12l6.8-6.8a1 1 0 0 1 1.4 0Z"
      clipRule="evenodd"
    />
  </svg>
);
const AVG_RESOLUTION_ICON = (
  <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
    <path d="M8 2a1 1 0 0 0 0 2h.09A6.5 6.5 0 1 0 13 4.35V4h.5a1 1 0 1 0 0-2h-5.5Zm2 4.5A4.5 4.5 0 1 1 5.5 11 4.5 4.5 0 0 1 10 6.5Zm0 2a1 1 0 0 0-1 1v1.59l-.7.7a1 1 0 1 0 1.4 1.42l1-1a1 1 0 0 0 .3-.71V9.5a1 1 0 0 0-1-1Z" />
  </svg>
);

function InfoCard({
  label,
  value,
  theme,
  icon,
}: {
  label: string;
  value: React.ReactNode;
  theme: keyof typeof STAT_CARD_THEMES;
  icon: React.ReactNode;
}) {
  const colors = STAT_CARD_THEMES[theme];

  return (
    <div className="flex items-center gap-4 rounded-2xl border border-border bg-surface p-4">
      <span
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${colors.icon}`}
      >
        {icon}
      </span>
      <span>
        <span className="block text-xs text-ink-sub">{label}</span>
        <span className="block text-2xl font-extrabold text-ink">{value}</span>
      </span>
    </div>
  );
}

export default async function PerformancePage({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string;
    from?: string;
    to?: string;
    page?: string;
    pageSize?: string;
  }>;
}) {
  const params = await searchParams;
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
    (profile?.role !== "company_admin" &&
      profile?.role !== "company_agent" &&
      profile?.role !== "supervisor") ||
    !profile.company_id
  ) {
    redirect("/login");
  }

  const [{ data: tickets }, { data: agents }] = await Promise.all([
    supabase
      .from("tickets")
      .select("id, subject, status, assigned_agent_id, received_at, closed_at")
      .eq("company_id", profile.company_id)
      .is("archived_at", null),
    supabase
      .from("profiles")
      .select("id, full_name, disabled")
      .eq("company_id", profile.company_id),
  ]);

  const agentNameById = await buildAgentNameMap(agents ?? []);
  const timezone = await getCompanyTimezone(supabase, profile.company_id);

  const inDateRange = (t: TicketRow) =>
    withinRange(relevantDate(t), timezone, params.from, params.to);

  if (profile.role === "company_agent") {
    const mine = (tickets ?? [])
      .filter((t) => t.assigned_agent_id === user.id)
      .filter(inDateRange);
    const closed = mine.filter((t) => t.status === "closed").length;
    const open = mine.length - closed;
    const avgResolution = averageResolutionSeconds(mine);

    const activeFilter =
      params.status === "closed" ? "closed" : params.status === "open" ? "open" : "";
    const filtered =
      activeFilter === "closed"
        ? mine.filter((t) => t.status === "closed")
        : activeFilter === "open"
          ? mine.filter((t) => t.status !== "closed")
          : mine;

    const {
      page: ticketPage,
      pageSize: ticketPageSize,
      totalPages: ticketTotalPages,
      start: ticketStart,
      end: ticketEnd,
    } = resolvePagination(filtered.length, params.page, params.pageSize);
    const pageFiltered = filtered.slice(ticketStart, ticketEnd);

    return (
      <div className="space-y-6">
        <h1 className="text-[22px] font-extrabold tracking-tight text-ink md:text-[27px]">
          {t("performance.myTitle")}
        </h1>

        <DateRangeFilter
          t={t}
          basePath="/dashboard/performance"
          status={params.status}
          from={params.from}
          to={params.to}
        />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:max-w-3xl lg:grid-cols-4">
          <StatCard
            label={t("performance.totalAssigned")}
            value={mine.length}
            href={buildHref("/dashboard/performance", {
              from: params.from,
              to: params.to,
            })}
            active={activeFilter === ""}
            theme="neutral"
            icon={TOTAL_ICON}
          />
          <StatCard
            label={t("performance.open")}
            value={open}
            href={buildHref("/dashboard/performance", {
              status: "open",
              from: params.from,
              to: params.to,
            })}
            active={activeFilter === "open"}
            theme="blue"
            icon={OPEN_ICON}
          />
          <StatCard
            label={t("performance.closed")}
            value={closed}
            href={buildHref("/dashboard/performance", {
              status: "closed",
              from: params.from,
              to: params.to,
            })}
            active={activeFilter === "closed"}
            theme="green"
            icon={CLOSED_ICON}
          />
          <InfoCard
            label={t("performance.avgResolution")}
            value={avgResolution !== null ? formatDuration(avgResolution) : "—"}
            theme="neutral"
            icon={AVG_RESOLUTION_ICON}
          />
        </div>

        <TicketTable
          t={t}
          tickets={pageFiltered}
          agentNameById={agentNameById}
          timezone={timezone}
          showAssignee={false}
          pagination={
            <TicketPagination
              t={t}
              page={ticketPage}
              totalPages={ticketTotalPages}
              pageSize={ticketPageSize}
              from={ticketStart + 1}
              to={ticketEnd}
              total={filtered.length}
              buildPageHref={(p) =>
                buildHref("/dashboard/performance", {
                  status: params.status,
                  from: params.from,
                  to: params.to,
                  pageSize: params.pageSize,
                  page: String(p),
                })
              }
              buildPageSizeHref={(s) =>
                buildHref("/dashboard/performance", {
                  status: params.status,
                  from: params.from,
                  to: params.to,
                  pageSize: String(s),
                  page: "1",
                })
              }
            />
          }
        />
      </div>
    );
  }

  const ticketsByAgent = new Map<string, TicketRow[]>();
  for (const ticket of (tickets ?? []) as TicketRow[]) {
    if (!ticket.assigned_agent_id || !inDateRange(ticket)) continue;
    const list = ticketsByAgent.get(ticket.assigned_agent_id) ?? [];
    list.push(ticket);
    ticketsByAgent.set(ticket.assigned_agent_id, list);
  }

  return (
    <div className="space-y-6">
      <h1 className="text-[22px] font-extrabold tracking-tight text-ink md:text-[27px]">
        {t("performance.teamTitle")}
      </h1>

      <DateRangeFilter
        t={t}
        basePath="/dashboard/performance"
        from={params.from}
        to={params.to}
      />

      <div className="rounded-2xl border border-border bg-surface shadow-card">
        <div className="overflow-x-auto">
          <table className="w-full text-start text-[13.5px]">
            <thead>
              <tr className="divide-x divide-border border-b border-border">
                <th className="px-4 py-2.5 text-[11.5px] font-bold tracking-wide text-ink-sub uppercase">
                  {t("performance.table.agent")}
                </th>
                <th className="px-4 py-2.5 text-[11.5px] font-bold tracking-wide text-ink-sub uppercase">
                  {t("performance.table.totalAssigned")}
                </th>
                <th className="px-4 py-2.5 text-[11.5px] font-bold tracking-wide text-ink-sub uppercase">
                  {t("performance.table.open")}
                </th>
                <th className="px-4 py-2.5 text-[11.5px] font-bold tracking-wide text-ink-sub uppercase">
                  {t("performance.table.closed")}
                </th>
                <th className="px-4 py-2.5 text-[11.5px] font-bold tracking-wide text-ink-sub uppercase">
                  {t("performance.table.avgResolution")}
                </th>
              </tr>
            </thead>
            <tbody>
              {(agents ?? []).map((agent) => {
                const agentTickets = ticketsByAgent.get(agent.id) ?? [];
                const closed = agentTickets.filter(
                  (t) => t.status === "closed",
                ).length;
                const open = agentTickets.length - closed;
                const avgResolution = averageResolutionSeconds(agentTickets);
                return (
                  <tr
                    key={agent.id}
                    className="divide-x divide-border border-b border-border last:border-0 hover:bg-surface-alt"
                  >
                    <td className="px-4 py-3 font-medium text-ink">
                      {agentNameById.get(agent.id) ?? t("common.unnamed")}
                    </td>
                    <td className="px-4 py-3 text-ink-sub">
                      {agentTickets.length}
                    </td>
                    <td className="px-4 py-3 text-ink-sub">{open}</td>
                    <td className="px-4 py-3 text-ink-sub">{closed}</td>
                    <td className="px-4 py-3 text-ink-sub">
                      {avgResolution !== null
                        ? formatDuration(avgResolution)
                        : "—"}
                    </td>
                  </tr>
                );
              })}
              {(agents ?? []).length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-ink-sub">
                    {t("performance.noTeamMembers")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function TicketTable({
  t,
  tickets,
  agentNameById,
  timezone,
  showAssignee,
  pagination,
}: {
  t: Translator;
  tickets: TicketRow[];
  agentNameById: Map<string, string>;
  timezone: string;
  showAssignee: boolean;
  pagination?: React.ReactNode;
}) {
  const sorted = [...tickets].sort(
    (a, b) =>
      new Date(relevantDate(b)).getTime() - new Date(relevantDate(a)).getTime(),
  );

  return (
    <div className="rounded-2xl border border-border bg-surface shadow-card">
      <div className="overflow-x-auto">
        <table className="w-full text-start text-[13.5px]">
          <thead>
            <tr className="divide-x divide-border border-b border-border">
              <th className="px-4 py-2.5 text-[11.5px] font-bold tracking-wide text-ink-sub uppercase">
                {t("performance.table.subject")}
              </th>
              <th className="px-4 py-2.5 text-[11.5px] font-bold tracking-wide text-ink-sub uppercase">
                {t("performance.table.status")}
              </th>
              {showAssignee && (
                <th className="px-4 py-2.5 text-[11.5px] font-bold tracking-wide text-ink-sub uppercase">
                  {t("performance.table.assignedTo")}
                </th>
              )}
              <th className="px-4 py-2.5 text-[11.5px] font-bold tracking-wide text-ink-sub uppercase">
                {t("performance.table.received")}
              </th>
              <th className="px-4 py-2.5 text-[11.5px] font-bold tracking-wide text-ink-sub uppercase">
                {t("performance.table.closedDate")}
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((ticket) => (
              <tr
                key={ticket.id}
                className="divide-x divide-border border-b border-border last:border-0 hover:bg-surface-alt"
              >
                <td className="px-4 py-3">
                  <Link
                    href={`/dashboard/tickets/${ticket.id}`}
                    className="font-medium text-ink hover:text-link-hover"
                  >
                    {ticket.subject}
                  </Link>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap ${STATUS_BADGE_CLASSES[ticket.status]}`}
                  >
                    {t(`status.${ticket.status}`)}
                  </span>
                </td>
                {showAssignee && (
                  <td className="px-4 py-3 text-ink-sub">
                    {ticket.assigned_agent_id
                      ? (agentNameById.get(ticket.assigned_agent_id) ?? "—")
                      : "—"}
                  </td>
                )}
                <td className="px-4 py-3 text-ink-sub">
                  {formatDate(ticket.received_at, timezone)}
                </td>
                <td className="px-4 py-3 text-ink-sub">
                  {ticket.closed_at
                    ? formatDate(ticket.closed_at, timezone)
                    : "—"}
                </td>
              </tr>
            ))}
            {sorted.length === 0 && (
              <tr>
                <td
                  colSpan={showAssignee ? 5 : 4}
                  className="px-4 py-8 text-center text-ink-sub"
                >
                  {t("performance.noTicketsAssigned")}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {pagination}
    </div>
  );
}
