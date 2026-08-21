import { redirect } from "next/navigation";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { buildAgentNameMap } from "@/lib/agentNames";
import { formatDateTime } from "@/lib/formatDate";
import { resolvePagination } from "@/lib/pagination";
import { TicketPagination } from "@/components/TicketPagination";

function buildHref(params: { page?: string; pageSize?: string }) {
  const query = new URLSearchParams();
  if (params.page) query.set("page", params.page);
  if (params.pageSize) query.set("pageSize", params.pageSize);
  const qs = query.toString();
  return qs ? `/dashboard/archived?${qs}` : "/dashboard/archived";
}

export default async function ArchivedTicketsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; pageSize?: string }>;
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

  if (profile?.role !== "company_admin" || !profile.company_id) {
    redirect("/dashboard");
  }

  const [{ data: tickets }, { data: agents }] = await Promise.all([
    supabase
      .from("tickets")
      .select(
        "id, subject, sender_email, sender_name, assigned_agent_id, archived_at",
      )
      .eq("company_id", profile.company_id)
      .not("archived_at", "is", null)
      .order("archived_at", { ascending: false }),
    supabase
      .from("profiles")
      .select("id, full_name, disabled")
      .eq("company_id", profile.company_id),
  ]);

  const agentNameById = await buildAgentNameMap(agents ?? []);

  const { page, pageSize, totalPages, start, end } = resolvePagination(
    (tickets ?? []).length,
    params.page,
    params.pageSize,
  );
  const pageTickets = (tickets ?? []).slice(start, end);

  return (
    <div className="space-y-5">
      <h1 className="text-[22px] font-extrabold tracking-tight text-ink md:text-[27px]">
        {t("archivedPage.title")}
      </h1>

      <div className="rounded-2xl border border-border bg-surface p-0 shadow-card">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[480px] text-start text-[13.5px]">
            <thead>
              <tr className="divide-x divide-border border-b border-border">
                <th className="px-4 py-2.5 text-[11.5px] font-bold tracking-wide text-ink-sub uppercase">
                  {t("archivedPage.table.subject")}
                </th>
                <th className="px-4 py-2.5 text-[11.5px] font-bold tracking-wide text-ink-sub uppercase">
                  {t("archivedPage.table.requester")}
                </th>
                <th className="px-4 py-2.5 text-[11.5px] font-bold tracking-wide text-ink-sub uppercase">
                  {t("archivedPage.table.assignedTo")}
                </th>
                <th className="px-4 py-2.5 text-[11.5px] font-bold tracking-wide text-ink-sub uppercase">
                  {t("archivedPage.table.archivedAt")}
                </th>
              </tr>
            </thead>
            <tbody>
              {pageTickets.map((ticket) => (
                <tr
                  key={ticket.id}
                  className="divide-x divide-border border-b border-border last:border-0 hover:bg-surface-alt"
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
                  <td className="px-4 py-3.5 text-ink-sub">
                    {ticket.assigned_agent_id
                      ? (agentNameById.get(ticket.assigned_agent_id) ?? "—")
                      : "—"}
                  </td>
                  <td className="px-4 py-3.5 text-ink-sub">
                    {ticket.archived_at
                      ? formatDateTime(ticket.archived_at)
                      : "—"}
                  </td>
                </tr>
              ))}
              {pageTickets.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-ink-sub">
                    {t("archivedPage.noTickets")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <TicketPagination
          t={t}
          page={page}
          totalPages={totalPages}
          pageSize={pageSize}
          from={start + 1}
          to={end}
          total={(tickets ?? []).length}
          buildPageHref={(p) => buildHref({ page: String(p), pageSize: params.pageSize })}
          buildPageSizeHref={(s) => buildHref({ pageSize: String(s), page: "1" })}
        />
      </div>
    </div>
  );
}
