import { redirect } from "next/navigation";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { buildAgentNameMap } from "@/lib/agentNames";

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

function withinRange(dateStr: string, from?: string, to?: string) {
  const date = dateStr.slice(0, 10);
  if (from && date < from) return false;
  if (to && date > to) return false;
  return true;
}

function buildHref(
  base: string,
  params: { status?: string; from?: string; to?: string },
) {
  const query = new URLSearchParams();
  if (params.status) query.set("status", params.status);
  if (params.from) query.set("from", params.from);
  if (params.to) query.set("to", params.to);
  const qs = query.toString();
  return qs ? `${base}?${qs}` : base;
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

function DateRangeFilter({
  t,
  status,
  from,
  to,
}: {
  t: Translator;
  status?: string;
  from?: string;
  to?: string;
}) {
  return (
    <form className="flex flex-wrap items-end gap-3 text-sm">
      {status && <input type="hidden" name="status" value={status} />}
      <div className="space-y-1">
        <label htmlFor="from" className="text-xs font-semibold text-ink-sub">
          {t("performance.dateFrom")}
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
          {t("performance.dateTo")}
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
        {t("performance.apply")}
      </button>
      {(from || to) && (
        <Link
          href={buildHref("/dashboard/performance", { status })}
          className="text-sm font-semibold text-ink-sub hover:underline"
        >
          {t("performance.clearDates")}
        </Link>
      )}
    </form>
  );
}

export default async function PerformancePage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; from?: string; to?: string }>;
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
    (profile?.role !== "company_admin" && profile?.role !== "company_agent") ||
    !profile.company_id
  ) {
    redirect("/login");
  }

  const [{ data: tickets }, { data: agents }] = await Promise.all([
    supabase
      .from("tickets")
      .select("id, subject, status, assigned_agent_id, received_at, closed_at")
      .eq("company_id", profile.company_id),
    supabase
      .from("profiles")
      .select("id, full_name")
      .eq("company_id", profile.company_id),
  ]);

  const agentNameById = await buildAgentNameMap(agents ?? []);

  const inDateRange = (t: TicketRow) =>
    withinRange(relevantDate(t), params.from, params.to);

  if (profile.role === "company_agent") {
    const mine = (tickets ?? [])
      .filter((t) => t.assigned_agent_id === user.id)
      .filter(inDateRange);
    const closed = mine.filter((t) => t.status === "closed").length;
    const open = mine.length - closed;

    const activeFilter =
      params.status === "closed" ? "closed" : params.status === "open" ? "open" : "";
    const filtered =
      activeFilter === "closed"
        ? mine.filter((t) => t.status === "closed")
        : activeFilter === "open"
          ? mine.filter((t) => t.status !== "closed")
          : mine;

    return (
      <div className="space-y-6">
        <h1 className="text-[22px] font-extrabold tracking-tight text-ink md:text-[27px]">
          {t("performance.myTitle")}
        </h1>

        <DateRangeFilter
          t={t}
          status={params.status}
          from={params.from}
          to={params.to}
        />

        <div className="grid grid-cols-1 gap-4 sm:max-w-xl sm:grid-cols-3">
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
        </div>

        <TicketTable
          t={t}
          tickets={filtered}
          agentNameById={agentNameById}
          showAssignee={false}
        />
      </div>
    );
  }

  const statsByAgent = new Map<
    string,
    { total: number; open: number; closed: number }
  >();
  for (const ticket of (tickets ?? []) as TicketRow[]) {
    if (!ticket.assigned_agent_id || !inDateRange(ticket)) continue;
    const stats = statsByAgent.get(ticket.assigned_agent_id) ?? {
      total: 0,
      open: 0,
      closed: 0,
    };
    stats.total += 1;
    if (ticket.status === "closed") stats.closed += 1;
    else stats.open += 1;
    statsByAgent.set(ticket.assigned_agent_id, stats);
  }

  return (
    <div className="space-y-6">
      <h1 className="text-[22px] font-extrabold tracking-tight text-ink md:text-[27px]">
        {t("performance.teamTitle")}
      </h1>

      <DateRangeFilter t={t} from={params.from} to={params.to} />

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
              </tr>
            </thead>
            <tbody>
              {(agents ?? []).map((agent) => {
                const stats = statsByAgent.get(agent.id) ?? {
                  total: 0,
                  open: 0,
                  closed: 0,
                };
                return (
                  <tr
                    key={agent.id}
                    className="divide-x divide-border border-b border-border last:border-0 hover:bg-surface-alt"
                  >
                    <td className="px-4 py-3 font-medium text-ink">
                      {agentNameById.get(agent.id) ?? t("common.unnamed")}
                    </td>
                    <td className="px-4 py-3 text-ink-sub">{stats.total}</td>
                    <td className="px-4 py-3 text-ink-sub">{stats.open}</td>
                    <td className="px-4 py-3 text-ink-sub">{stats.closed}</td>
                  </tr>
                );
              })}
              {(agents ?? []).length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-ink-sub">
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
  showAssignee,
}: {
  t: Translator;
  tickets: TicketRow[];
  agentNameById: Map<string, string>;
  showAssignee: boolean;
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
                    className="font-medium text-ink hover:text-primary"
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
                  {new Date(ticket.received_at).toLocaleDateString()}
                </td>
                <td className="px-4 py-3 text-ink-sub">
                  {ticket.closed_at
                    ? new Date(ticket.closed_at).toLocaleDateString()
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
    </div>
  );
}
