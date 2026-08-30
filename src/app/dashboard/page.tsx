import { redirect } from "next/navigation";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { buildAgentNameMap } from "@/lib/agentNames";
import { formatDateTime } from "@/lib/formatDate";
import { getCompanyTimezone } from "@/lib/companyTimezone";

const STATUS_BADGE_CLASSES: Record<string, string> = {
  new: "bg-info-soft text-info",
  pending: "bg-warning-soft text-warning",
  on_process: "bg-primary-soft text-primary",
  closed: "bg-surface-alt text-ink-sub",
};

function KpiCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-5 shadow-card">
      <div className="text-[12.5px] font-semibold text-ink-sub">{label}</div>
      <div className="mt-1.5 text-[26px] font-extrabold text-ink">{value}</div>
    </div>
  );
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
    (profile?.role !== "company_admin" &&
      profile?.role !== "company_agent" &&
      profile?.role !== "supervisor") ||
    !profile.company_id
  ) {
    redirect("/login");
  }

  const [{ data: tickets }, { data: recentTickets }, { data: agents }] =
    await Promise.all([
      supabase
        .from("tickets")
        .select("status")
        .eq("company_id", profile.company_id)
        .is("archived_at", null),
      supabase
        .from("tickets")
        .select(
          "id, subject, sender_email, sender_name, status, assigned_agent_id, received_at",
        )
        .eq("company_id", profile.company_id)
        .is("archived_at", null)
        .order("received_at", { ascending: false })
        .limit(5),
      supabase
        .from("profiles")
        .select("id, full_name, disabled")
        .eq("company_id", profile.company_id),
    ]);

  const agentNameById = await buildAgentNameMap(agents ?? []);
  const timezone = await getCompanyTimezone(supabase, profile.company_id);

  const counts = { total: 0, open: 0, new: 0, pending: 0, on_process: 0, closed: 0 };
  for (const ticket of tickets ?? []) {
    counts.total += 1;
    if (ticket.status === "new") counts.new += 1;
    if (ticket.status === "pending") counts.pending += 1;
    if (ticket.status === "on_process") counts.on_process += 1;
    if (ticket.status === "closed") counts.closed += 1;
    else counts.open += 1;
  }

  const displayName = (profile.full_name ?? user.email ?? "").split(" ")[0];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[22px] font-extrabold tracking-tight text-ink md:text-[27px]">
          {t("home.greeting", { name: displayName })}
        </h1>
        <p className="mt-1 text-sm text-ink-sub">{t("home.subtitle")}</p>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
        <KpiCard label={t("home.kpiTotal")} value={counts.total} />
        <KpiCard label={t("home.kpiOpen")} value={counts.open} />
        <KpiCard label={t("home.kpiNew")} value={counts.new} />
        <KpiCard label={t("home.kpiPending")} value={counts.pending} />
        <KpiCard label={t("home.kpiOnProcess")} value={counts.on_process} />
        <KpiCard label={t("home.kpiClosed")} value={counts.closed} />
      </div>

      <div className="rounded-2xl border border-border bg-surface p-5 shadow-card">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-[15.5px] font-extrabold text-ink">
            {t("home.recentTickets")}
          </h2>
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
                    {formatDateTime(ticket.received_at, timezone)}
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
