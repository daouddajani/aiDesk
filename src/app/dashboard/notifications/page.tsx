import { redirect } from "next/navigation";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/formatDate";
import { getCompanyTimezone } from "@/lib/companyTimezone";
import { MarkNotificationReadButton } from "./MarkNotificationReadButton";
import { MarkAllReadButton } from "./MarkAllReadButton";

export default async function NotificationsPage() {
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

  const timezone = await getCompanyTimezone(supabase, profile.company_id);

  const { data: notifications } = await supabase
    .from("ticket_notifications")
    .select(
      "id, ticket_id, ticket_subject, is_internal, author_label, comment_preview, read_at, created_at",
    )
    .eq("agent_id", user.id)
    .order("created_at", { ascending: false })
    .limit(100);

  const hasUnread = (notifications ?? []).some((n) => !n.read_at);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-[22px] font-extrabold tracking-tight text-ink md:text-[27px]">
          {t("notificationsPage.title")}
        </h1>
        {hasUnread && <MarkAllReadButton />}
      </div>

      <div className="rounded-2xl border border-border bg-surface p-0 shadow-card">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-start text-[13.5px]">
            <thead>
              <tr className="divide-x divide-border border-b border-border">
                <th className="px-4 py-2.5 text-[11.5px] font-bold tracking-wide text-ink-sub uppercase">
                  {t("notificationsPage.table.ticket")}
                </th>
                <th className="px-4 py-2.5 text-[11.5px] font-bold tracking-wide text-ink-sub uppercase">
                  {t("notificationsPage.table.type")}
                </th>
                <th className="px-4 py-2.5 text-[11.5px] font-bold tracking-wide text-ink-sub uppercase">
                  {t("notificationsPage.table.from")}
                </th>
                <th className="px-4 py-2.5 text-[11.5px] font-bold tracking-wide text-ink-sub uppercase">
                  {t("notificationsPage.table.preview")}
                </th>
                <th className="px-4 py-2.5 text-[11.5px] font-bold tracking-wide text-ink-sub uppercase">
                  {t("notificationsPage.table.when")}
                </th>
                <th className="px-4 py-2.5 text-[11.5px] font-bold tracking-wide text-ink-sub uppercase">
                  {t("notificationsPage.table.actions")}
                </th>
              </tr>
            </thead>
            <tbody>
              {(notifications ?? []).map((notification) => {
                const unread = !notification.read_at;
                return (
                  <tr
                    key={notification.id}
                    className={`divide-x divide-border border-b border-border last:border-0 ${
                      unread ? "" : "opacity-60"
                    }`}
                  >
                    <td className="px-4 py-3.5">
                      <Link
                        href={`/dashboard/tickets/${notification.ticket_id}`}
                        className={`hover:text-primary ${unread ? "font-bold text-ink" : "font-medium text-ink"}`}
                      >
                        {notification.ticket_subject}
                      </Link>
                    </td>
                    <td className="px-4 py-3.5 text-ink-sub">
                      {notification.is_internal
                        ? t("notificationsPage.internalBadge")
                        : t("notificationsPage.replyBadge")}
                    </td>
                    <td className="px-4 py-3.5 text-ink-sub">
                      {notification.author_label}
                    </td>
                    <td className="max-w-[280px] truncate px-4 py-3.5 text-ink-sub">
                      {notification.comment_preview}
                    </td>
                    <td className="px-4 py-3.5 text-ink-sub">
                      {formatDateTime(notification.created_at, timezone)}
                    </td>
                    <td className="px-4 py-3.5">
                      {unread && (
                        <MarkNotificationReadButton
                          notificationId={notification.id}
                        />
                      )}
                    </td>
                  </tr>
                );
              })}
              {(notifications ?? []).length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-ink-sub">
                    {t("notificationsPage.empty")}
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
