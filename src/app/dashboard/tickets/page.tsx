import { redirect } from "next/navigation";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { buildAgentNameMap } from "@/lib/agentNames";
import { formatDuration } from "@/lib/duration";

const STATUS_VALUES = ["new", "pending", "on_process", "closed"] as const;

const STATUS_BADGE_CLASSES: Record<string, string> = {
  new: "bg-info-soft text-info",
  pending: "bg-warning-soft text-warning",
  on_process: "bg-primary-soft text-primary",
  closed: "bg-surface-alt text-ink-sub",
};

function startOfWeekISO(d = new Date()) {
  const day = d.getUTCDay(); // 0 (Sun) - 6 (Sat)
  const diffFromMonday = day === 0 ? 6 : day - 1;
  const monday = new Date(d);
  monday.setUTCDate(d.getUTCDate() - diffFromMonday);
  return monday.toISOString().slice(0, 10);
}

function todayISO(d = new Date()) {
  return d.toISOString().slice(0, 10);
}

function buildHref(
  base: string,
  params: { status?: string; mine?: string; from?: string; to?: string },
) {
  const query = new URLSearchParams();
  if (params.status) query.set("status", params.status);
  if (params.mine) query.set("mine", params.mine);
  if (params.from) query.set("from", params.from);
  if (params.to) query.set("to", params.to);
  const qs = query.toString();
  return qs ? `${base}?${qs}` : base;
}

export default async function TicketsListPage({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string;
    mine?: string;
    from?: string;
    to?: string;
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
    (profile?.role !== "company_admin" && profile?.role !== "company_agent") ||
    !profile.company_id
  ) {
    redirect("/login");
  }

  // Agents default to seeing only their own tickets; admins default to the
  // whole company's. Either can flip it via ?mine=me / ?mine=all.
  const defaultMine = profile.role === "company_agent";
  const showMineOnly = params.mine ? params.mine === "me" : defaultMine;

  const from = params.from || startOfWeekISO();
  const to = params.to || todayISO();

  let query = supabase
    .from("tickets")
    .select(
      "id, subject, sender_email, sender_name, status, assigned_agent_id, received_at, closed_at",
    )
    .eq("company_id", profile.company_id)
    .gte("received_at", `${from}T00:00:00`)
    .lte("received_at", `${to}T23:59:59.999`)
    .order("received_at", { ascending: false });

  if (showMineOnly) {
    query = query.eq("assigned_agent_id", user.id);
  }

  const [{ data: allTickets }, { data: agents }] = await Promise.all([
    query,
    supabase
      .from("profiles")
      .select("id, full_name")
      .eq("company_id", profile.company_id),
  ]);

  const agentNameById = await buildAgentNameMap(agents ?? []);

  // Counts reflect the mine/date filters but not the active status tab, so
  // switching tabs doesn't change the numbers shown on the other tabs.
  const counts: Record<string, number> = { all: (allTickets ?? []).length };
  for (const status of STATUS_VALUES) {
    counts[status] = (allTickets ?? []).filter((tk) => tk.status === status).length;
  }

  const tickets = params.status
    ? (allTickets ?? []).filter((tk) => tk.status === params.status)
    : (allTickets ?? []);

  const tabs = [
    { value: "", label: t("dashboard.statusTabs.all"), count: counts.all },
    ...STATUS_VALUES.map((v) => ({
      value: v,
      label: t(`status.${v}`),
      count: counts[v],
    })),
  ];

  const hrefFor = (overrides: { status?: string; mine?: string }) =>
    buildHref("/dashboard/tickets", {
      status: params.status,
      mine: params.mine,
      from: params.from,
      to: params.to,
      ...overrides,
    });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-extrabold tracking-tight text-ink md:text-[27px]">
            {t("dashboard.title")}
          </h1>
        </div>

        <div className="flex items-center gap-1 rounded-[10px] border border-border bg-surface p-1">
          <Link
            href={hrefFor({ mine: "me" })}
            className={`rounded-lg px-3 py-1.5 text-[13px] font-semibold transition-colors ${
              showMineOnly
                ? "bg-primary text-white"
                : "text-ink-sub hover:bg-surface-alt"
            }`}
          >
            {t("dashboard.mineOnly")}
          </Link>
          <Link
            href={hrefFor({ mine: "all" })}
            className={`rounded-lg px-3 py-1.5 text-[13px] font-semibold transition-colors ${
              !showMineOnly
                ? "bg-primary text-white"
                : "text-ink-sub hover:bg-surface-alt"
            }`}
          >
            {t("dashboard.allTickets")}
          </Link>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {tabs.map((tab) => {
          const active = (params.status ?? "") === tab.value;
          return (
            <Link
              key={tab.value || "all"}
              href={hrefFor({ status: tab.value })}
              className={`rounded-[10px] border px-4 py-2 text-[13px] font-semibold transition-colors ${
                active
                  ? "border-primary bg-primary text-white"
                  : "border-border bg-surface text-ink hover:bg-surface-alt"
              }`}
            >
              {tab.label}{" "}
              <span
                className={active ? "text-white/80" : "text-ink-sub"}
              >
                ({tab.count})
              </span>
            </Link>
          );
        })}
      </div>

      <form className="flex flex-wrap items-end gap-3 text-sm">
        {params.status && (
          <input type="hidden" name="status" value={params.status} />
        )}
        {params.mine && <input type="hidden" name="mine" value={params.mine} />}
        <div className="space-y-1">
          <label htmlFor="from" className="text-xs font-semibold text-ink-sub">
            {t("dashboard.dateFrom")}
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
            {t("dashboard.dateTo")}
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
          {t("dashboard.apply")}
        </button>
        {(params.from || params.to) && (
          <Link
            href={hrefFor({})}
            className="text-sm font-semibold text-ink-sub hover:underline"
          >
            {t("dashboard.clearDates")}
          </Link>
        )}
      </form>

      <div className="rounded-2xl border border-border bg-surface p-0 shadow-card">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-start text-[13.5px]">
            <thead>
              <tr className="divide-x divide-border border-b border-border">
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
                <th className="px-4 py-2.5 text-[11.5px] font-bold tracking-wide text-ink-sub uppercase">
                  {t("dashboard.table.openDuration")}
                </th>
              </tr>
            </thead>
            <tbody>
              {tickets.map((ticket) => (
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
                  <td className="px-4 py-3.5 text-ink-sub">
                    {formatDuration(
                      ((ticket.closed_at
                        ? new Date(ticket.closed_at)
                        : new Date()
                      ).getTime() -
                        new Date(ticket.received_at).getTime()) /
                        1000,
                    )}
                  </td>
                </tr>
              ))}
              {tickets.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-ink-sub">
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
