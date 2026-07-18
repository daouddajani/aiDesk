import { redirect } from "next/navigation";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { buildAgentNameMap } from "@/lib/agentNames";
import { formatDuration } from "@/lib/duration";

const STATUS_BADGE_CLASSES: Record<string, string> = {
  new: "bg-info-soft text-info",
  pending: "bg-warning-soft text-warning",
  on_process: "bg-primary-soft text-primary",
  closed: "bg-surface-alt text-ink-sub",
};

function KpiCard({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-5 shadow-card">
      <div className="text-[12.5px] font-semibold text-ink-sub">{label}</div>
      <div className="mt-1.5 text-[26px] font-extrabold text-ink">{value}</div>
    </div>
  );
}

type TicketPerf = {
  status: string;
  assigned_agent_id: string | null;
  received_at: string;
  closed_at: string | null;
};

// Basic performance stats per app.md: tickets closed, average resolution
// time, current open count.
function agentPerformance(tickets: TicketPerf[], agentId: string) {
  const mine = tickets.filter((t) => t.assigned_agent_id === agentId);
  const closed = mine.filter((t) => t.status === "closed");
  const open = mine.length - closed.length;

  const resolutionSeconds = closed
    .filter((t) => t.closed_at)
    .map(
      (t) =>
        (new Date(t.closed_at!).getTime() - new Date(t.received_at).getTime()) /
        1000,
    );
  const avgResolutionSeconds = resolutionSeconds.length
    ? resolutionSeconds.reduce((a, b) => a + b, 0) / resolutionSeconds.length
    : null;

  return { total: mine.length, open, closed: closed.length, avgResolutionSeconds };
}

export default async function DashboardHomePage() {
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
    .select("role, company_id, full_name")
    .eq("id", user.id)
    .single();

  if (
    (profile?.role !== "company_admin" && profile?.role !== "company_agent") ||
    !profile.company_id
  ) {
    redirect("/login");
  }

  const [{ data: tickets }, { data: recentTickets }, { data: agents }] =
    await Promise.all([
      supabase
        .from("tickets")
        .select("status, assigned_agent_id, received_at, closed_at")
        .eq("company_id", profile.company_id),
      supabase
        .from("tickets")
        .select(
          "id, subject, sender_email, sender_name, status, assigned_agent_id, received_at",
        )
        .eq("company_id", profile.company_id)
        .order("received_at", { ascending: false })
        .limit(5),
      supabase
        .from("profiles")
        .select("id, full_name")
        .eq("company_id", profile.company_id),
    ]);

  const agentNameById = await buildAgentNameMap(agents ?? []);

  const counts = { total: 0, new: 0, on_process: 0, closed: 0 };
  for (const ticket of tickets ?? []) {
    counts.total += 1;
    if (ticket.status === "new") counts.new += 1;
    if (ticket.status === "on_process") counts.on_process += 1;
    if (ticket.status === "closed") counts.closed += 1;
  }

  const displayName = (profile.full_name ?? user.email ?? "").split(" ")[0];

  const allTickets = (tickets ?? []) as TicketPerf[];
  const myPerformance =
    profile.role === "company_agent"
      ? agentPerformance(allTickets, user.id)
      : null;
  const agentPerformanceRows =
    profile.role === "company_admin"
      ? (agents ?? []).map((agent) => ({
          agentId: agent.id,
          name: agentNameById.get(agent.id) ?? t("common.unnamed"),
          ...agentPerformance(allTickets, agent.id),
        }))
      : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[22px] font-extrabold tracking-tight text-ink md:text-[27px]">
          {t("home.greeting", { name: displayName })}
        </h1>
        <p className="mt-1 text-sm text-ink-sub">{t("home.subtitle")}</p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard label={t("home.kpiTotal")} value={counts.total} />
        <KpiCard label={t("home.kpiNew")} value={counts.new} />
        <KpiCard label={t("home.kpiOnProcess")} value={counts.on_process} />
        <KpiCard label={t("home.kpiClosed")} value={counts.closed} />
      </div>

      {myPerformance && (
        <div className="space-y-3">
          <h3 className="text-[15.5px] font-extrabold text-ink">
            {t("home.yourPerformance")}
          </h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <KpiCard label={t("home.kpiOpenAssigned")} value={myPerformance.open} />
            <KpiCard
              label={t("home.kpiClosedAssigned")}
              value={myPerformance.closed}
            />
            <KpiCard
              label={t("home.kpiAvgResolution")}
              value={
                myPerformance.avgResolutionSeconds !== null
                  ? formatDuration(myPerformance.avgResolutionSeconds)
                  : "—"
              }
            />
          </div>
        </div>
      )}

      {profile.role === "company_admin" && (
        <div className="rounded-2xl border border-border bg-surface shadow-card">
          <div className="flex items-center justify-between p-5 pb-0">
            <h3 className="text-[15.5px] font-extrabold text-ink">
              {t("home.agentPerformance")}
            </h3>
            <Link
              href="/dashboard/performance"
              className="text-[13px] font-bold text-primary hover:underline"
            >
              {t("home.viewFullPerformance")} →
            </Link>
          </div>
          <div className="overflow-x-auto p-5">
            <table className="w-full text-start text-[13.5px]">
              <thead>
                <tr className="divide-x divide-border border-b border-border">
                  <th className="px-3 py-2.5 text-[11.5px] font-bold tracking-wide text-ink-sub uppercase">
                    {t("performance.table.agent")}
                  </th>
                  <th className="px-3 py-2.5 text-[11.5px] font-bold tracking-wide text-ink-sub uppercase">
                    {t("performance.table.open")}
                  </th>
                  <th className="px-3 py-2.5 text-[11.5px] font-bold tracking-wide text-ink-sub uppercase">
                    {t("performance.table.closed")}
                  </th>
                  <th className="px-3 py-2.5 text-[11.5px] font-bold tracking-wide text-ink-sub uppercase">
                    {t("home.kpiAvgResolution")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {agentPerformanceRows.map((row) => (
                  <tr
                    key={row.agentId}
                    className="divide-x divide-border border-b border-border last:border-0 hover:bg-surface-alt"
                  >
                    <td className="px-3 py-3 font-medium text-ink">{row.name}</td>
                    <td className="px-3 py-3 text-ink-sub">{row.open}</td>
                    <td className="px-3 py-3 text-ink-sub">{row.closed}</td>
                    <td className="px-3 py-3 text-ink-sub">
                      {row.avgResolutionSeconds !== null
                        ? formatDuration(row.avgResolutionSeconds)
                        : "—"}
                    </td>
                  </tr>
                ))}
                {agentPerformanceRows.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-3 py-8 text-center text-ink-sub">
                      {t("performance.noTeamMembers")}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-border bg-surface p-5 shadow-card">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-[15.5px] font-extrabold text-ink">
            {t("home.recentTickets")}
          </h3>
          <Link
            href="/dashboard/tickets"
            className="text-[13px] font-bold text-primary hover:underline"
          >
            {t("home.viewAll")} →
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[480px] text-start text-[13.5px]">
            <thead>
              <tr className="divide-x divide-border border-b border-border">
                <th className="px-3 py-2.5 text-[11.5px] font-bold tracking-wide text-ink-sub uppercase">
                  {t("dashboard.table.subject")}
                </th>
                <th className="px-3 py-2.5 text-[11.5px] font-bold tracking-wide text-ink-sub uppercase">
                  {t("dashboard.table.status")}
                </th>
                <th className="px-3 py-2.5 text-[11.5px] font-bold tracking-wide text-ink-sub uppercase">
                  {t("dashboard.table.assignedTo")}
                </th>
                <th className="px-3 py-2.5 text-[11.5px] font-bold tracking-wide text-ink-sub uppercase">
                  {t("dashboard.table.received")}
                </th>
              </tr>
            </thead>
            <tbody>
              {(recentTickets ?? []).map((ticket) => (
                <tr
                  key={ticket.id}
                  className="divide-x divide-border border-b border-border last:border-0 hover:bg-surface-alt"
                >
                  <td className="px-3 py-3">
                    <Link
                      href={`/dashboard/tickets/${ticket.id}`}
                      className="font-medium text-ink hover:text-primary"
                    >
                      {ticket.subject}
                    </Link>
                  </td>
                  <td className="px-3 py-3">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap ${STATUS_BADGE_CLASSES[ticket.status]}`}
                    >
                      {t(`status.${ticket.status}`)}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-ink-sub">
                    {ticket.assigned_agent_id
                      ? (agentNameById.get(ticket.assigned_agent_id) ?? "—")
                      : "—"}
                  </td>
                  <td className="px-3 py-3 text-ink-sub">
                    {new Date(ticket.received_at).toLocaleString()}
                  </td>
                </tr>
              ))}
              {(recentTickets ?? []).length === 0 && (
                <tr>
                  <td colSpan={4} className="px-3 py-8 text-center text-ink-sub">
                    {t("dashboard.noTickets")}
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
