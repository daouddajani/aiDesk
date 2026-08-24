import { redirect } from "next/navigation";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/formatDate";
import { getCompanyTimezone } from "@/lib/companyTimezone";
import { DeleteReminderButton } from "./DeleteReminderButton";

export default async function RemindersPage() {
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

  const timezone = await getCompanyTimezone(supabase, profile.company_id);

  const { data: reminders } = await supabase
    .from("reminders")
    .select("id, ticket_id, remind_at, comment")
    .eq("agent_id", user.id)
    .is("sent_at", null)
    .order("remind_at", { ascending: true });

  const ticketIds = [...new Set((reminders ?? []).map((r) => r.ticket_id))];
  const { data: tickets } = ticketIds.length
    ? await supabase.from("tickets").select("id, subject").in("id", ticketIds)
    : { data: [] };
  const subjectByTicketId = new Map(
    (tickets ?? []).map((tk) => [tk.id, tk.subject]),
  );

  return (
    <div className="space-y-5">
      <h1 className="text-[22px] font-extrabold tracking-tight text-ink md:text-[27px]">
        {t("reminders.title")}
      </h1>

      <div className="rounded-2xl border border-border bg-surface p-0 shadow-card">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-start text-[13.5px]">
            <thead>
              <tr className="divide-x divide-border border-b border-border">
                <th className="px-4 py-2.5 text-[11.5px] font-bold tracking-wide text-ink-sub uppercase">
                  {t("reminders.table.ticket")}
                </th>
                <th className="px-4 py-2.5 text-[11.5px] font-bold tracking-wide text-ink-sub uppercase">
                  {t("reminders.table.dueAt")}
                </th>
                <th className="px-4 py-2.5 text-[11.5px] font-bold tracking-wide text-ink-sub uppercase">
                  {t("reminders.table.comment")}
                </th>
                <th className="px-4 py-2.5 text-[11.5px] font-bold tracking-wide text-ink-sub uppercase">
                  {t("reminders.table.actions")}
                </th>
              </tr>
            </thead>
            <tbody>
              {(reminders ?? []).map((reminder) => (
                <tr
                  key={reminder.id}
                  className="divide-x divide-border border-b border-border last:border-0"
                >
                  <td className="px-4 py-3.5">
                    <Link
                      href={`/dashboard/tickets/${reminder.ticket_id}`}
                      className="font-medium text-ink hover:text-primary"
                    >
                      {subjectByTicketId.get(reminder.ticket_id) ?? reminder.ticket_id}
                    </Link>
                  </td>
                  <td className="px-4 py-3.5 text-ink-sub">
                    {formatDateTime(reminder.remind_at, timezone)}
                  </td>
                  <td className="px-4 py-3.5 text-ink-sub">{reminder.comment}</td>
                  <td className="px-4 py-3.5">
                    <DeleteReminderButton reminderId={reminder.id} />
                  </td>
                </tr>
              ))}
              {(reminders ?? []).length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-ink-sub">
                    {t("reminders.empty")}
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
