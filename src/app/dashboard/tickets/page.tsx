import { redirect } from "next/navigation";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { buildAgentNameMap } from "@/lib/agentNames";

const STATUS_VALUES = ["new", "pending", "on_process", "closed"] as const;

const STATUS_BADGE_CLASSES: Record<string, string> = {
  new: "bg-info-soft text-info",
  pending: "bg-warning-soft text-warning",
  on_process: "bg-primary-soft text-primary",
  closed: "bg-surface-alt text-ink-sub",
};

export default async function TicketsListPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
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

  let query = supabase
    .from("tickets")
    .select(
      "id, subject, sender_email, sender_name, status, assigned_agent_id, received_at",
    )
    .eq("company_id", profile.company_id)
    .order("received_at", { ascending: false });

  if (params.status) {
    query = query.eq("status", params.status);
  }

  const [{ data: tickets }, { data: agents }] = await Promise.all([
    query,
    supabase
      .from("profiles")
      .select("id, full_name")
      .eq("company_id", profile.company_id),
  ]);

  const agentNameById = await buildAgentNameMap(agents ?? []);

  const tabs = [
    { value: "", label: t("dashboard.statusTabs.all") },
    ...STATUS_VALUES.map((v) => ({ value: v, label: t(`status.${v}`) })),
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-extrabold tracking-tight text-ink md:text-[27px]">
            {t("dashboard.title")}
          </h1>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {tabs.map((tab) => {
          const active = (params.status ?? "") === tab.value;
          return (
            <Link
              key={tab.value}
              href={tab.value ? `/dashboard/tickets?status=${tab.value}` : "/dashboard/tickets"}
              className={`rounded-[10px] border px-4 py-2 text-[13px] font-semibold transition-colors ${
                active
                  ? "border-primary bg-primary text-white"
                  : "border-border bg-surface text-ink hover:bg-surface-alt"
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>

      <div className="rounded-2xl border border-border bg-surface p-0 shadow-card">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-start text-[13.5px]">
            <thead>
              <tr className="border-b border-border">
                <th className="px-4 py-2.5 text-[11.5px] font-bold tracking-wide text-ink-sub uppercase">
                  {t("dashboard.table.subject")}
                </th>
                <th className="px-4 py-2.5 text-[11.5px] font-bold tracking-wide text-ink-sub uppercase">
                  {t("dashboard.table.requester")}
                </th>
                <th className="px-4 py-2.5 text-[11.5px] font-bold tracking-wide text-ink-sub uppercase">
                  {t("dashboard.table.status")}
                </th>
                <th className="px-4 py-2.5 text-[11.5px] font-bold tracking-wide text-ink-sub uppercase">
                  {t("dashboard.table.assignedTo")}
                </th>
                <th className="px-4 py-2.5 text-[11.5px] font-bold tracking-wide text-ink-sub uppercase">
                  {t("dashboard.table.received")}
                </th>
              </tr>
            </thead>
            <tbody>
              {(tickets ?? []).map((ticket) => (
                <tr
                  key={ticket.id}
                  className="cursor-pointer divide-x divide-border border-b border-border last:border-0 hover:bg-surface-alt"
                >
                  <td className="px-4 py-3.5">
                    <Link
                      href={`/dashboard/tickets/${ticket.id}`}
                      className="font-medium text-ink hover:text-primary"
                    >
                      {ticket.subject}
                    </Link>
                  </td>
                  <td className="px-4 py-3.5 text-ink-sub">
                    {ticket.sender_name ?? ticket.sender_email}
                  </td>
                  <td className="px-4 py-3.5">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap ${STATUS_BADGE_CLASSES[ticket.status]}`}
                    >
                      {t(`status.${ticket.status}`)}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-ink-sub">
                    {ticket.assigned_agent_id
                      ? (agentNameById.get(ticket.assigned_agent_id) ?? "—")
                      : "—"}
                  </td>
                  <td className="px-4 py-3.5 text-ink-sub">
                    {new Date(ticket.received_at).toLocaleString()}
                  </td>
                </tr>
              ))}
              {(tickets ?? []).length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-ink-sub">
                    {params.status
                      ? t("dashboard.noTicketsWithStatus", {
                          status: t(`status.${params.status}`),
                        })
                      : t("dashboard.noTickets")}
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
