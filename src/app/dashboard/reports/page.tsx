import { redirect } from "next/navigation";
import { getTranslations, getLocale } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { getCompanyTimezone } from "@/lib/companyTimezone";
import {
  toLocalDateString,
  daysAgoLocalDateString,
  todayLocalDateString,
} from "@/lib/timezone";
import { DateRangeFilter } from "@/components/DateRangeFilter";
import {
  TicketsPerDayChart,
  HoursPerDayChart,
  HorizontalBarChart,
  StatusBreakdownChart,
  DayOfWeekChart,
  HourOfDayChart,
} from "./charts";

type Translator = Awaited<ReturnType<typeof getTranslations>>;

type TicketRow = {
  id: string;
  status: string;
  sender_email: string;
  sender_name: string | null;
  category: string | null;
  received_at: string;
};

type TimeEntryRow = {
  agent_id: string;
  started_at: string;
  ended_at: string | null;
};

// A currently-running entry (ended_at null) counts its elapsed time up to now.
function timeEntrySeconds(entry: TimeEntryRow): number {
  const start = new Date(entry.started_at).getTime();
  const end = entry.ended_at ? new Date(entry.ended_at).getTime() : Date.now();
  return Math.max(0, (end - start) / 1000);
}

const STATUS_VALUES = ["new", "pending", "on_process", "closed"] as const;

function withinRange(dateStr: string, timeZone: string, from: string, to: string) {
  const date = toLocalDateString(dateStr, timeZone);
  return date >= from && date <= to;
}

function eachDateInRange(from: string, to: string): string[] {
  const [y, m, d] = from.split("-").map(Number);
  const dates: string[] = [];
  let cursor = new Date(Date.UTC(y, m - 1, d));
  while (toLocalDateString(cursor, "UTC") <= to) {
    dates.push(toLocalDateString(cursor, "UTC"));
    cursor = new Date(cursor.getTime() + 86_400_000);
  }
  return dates;
}

function localWeekdayIndex(dateStr: string, timeZone: string): number {
  const [y, m, d] = toLocalDateString(dateStr, timeZone).split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

// 0..23, the company-local hour a timestamp falls in.
function localHourIndex(dateStr: string, timeZone: string): number {
  return Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      hour: "2-digit",
      hourCycle: "h23",
    }).format(new Date(dateStr)),
  );
}

// Locale-aware hour-of-day labels, indexed 0..23.
function hourLabels(locale: string): string[] {
  const formatter = new Intl.DateTimeFormat(locale, {
    hour: "numeric",
    timeZone: "UTC",
  });
  return Array.from({ length: 24 }, (_, h) =>
    formatter.format(new Date(Date.UTC(1970, 0, 1, h))),
  );
}

// Deterministic locale-aware weekday labels, indexed 0=Sun..6=Sat to match
// Date#getUTCDay() — 1970-01-04 (UTC) is a known Sunday.
function weekdayLabels(locale: string): string[] {
  const formatter = new Intl.DateTimeFormat(locale, {
    weekday: "short",
    timeZone: "UTC",
  });
  return Array.from({ length: 7 }, (_, i) =>
    formatter.format(new Date(Date.UTC(1970, 0, 4 + i))),
  );
}

function titleCase(s: string) {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

function ReportCard({
  title,
  hasData,
  t,
  children,
}: {
  title: string;
  hasData: boolean;
  t: Translator;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-4 shadow-card">
      <h2 className="mb-3 text-sm font-bold text-ink">{title}</h2>
      {hasData ? children : (
        <p className="py-10 text-center text-sm text-ink-sub">{t("reports.noData")}</p>
      )}
    </div>
  );
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const params = await searchParams;
  const t = await getTranslations();
  const locale = await getLocale();
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
    (profile?.role !== "company_admin" && profile?.role !== "supervisor") ||
    !profile.company_id
  ) {
    redirect("/dashboard");
  }

  const timezone = await getCompanyTimezone(supabase, profile.company_id);
  const from = params.from || daysAgoLocalDateString(timezone, 15);
  const to = params.to || todayLocalDateString(timezone);

  const { data: tickets } = await supabase
    .from("tickets")
    .select("id, status, sender_email, sender_name, category, received_at")
    .eq("company_id", profile.company_id)
    .is("archived_at", null);

  const { data: timeEntries } = await supabase
    .from("ticket_time_entries")
    .select("agent_id, started_at, ended_at")
    .eq("company_id", profile.company_id);

  const filtered = ((tickets ?? []) as TicketRow[]).filter((ticket) =>
    withinRange(ticket.received_at, timezone, from, to),
  );

  const filteredTimeEntries = ((timeEntries ?? []) as TimeEntryRow[]).filter((entry) =>
    withinRange(entry.started_at, timezone, from, to),
  );

  // 1. Tickets opened per day, zero-filled so the line doesn't skip days.
  const perDayCounts = new Map<string, number>();
  for (const ticket of filtered) {
    const day = toLocalDateString(ticket.received_at, timezone);
    perDayCounts.set(day, (perDayCounts.get(day) ?? 0) + 1);
  }
  const perDayData = eachDateInRange(from, to).map((date) => ({
    date,
    count: perDayCounts.get(date) ?? 0,
  }));

  // 1b. Tracked hours logged per day, zero-filled to match the ticket trend.
  const perDaySeconds = new Map<string, number>();
  for (const entry of filteredTimeEntries) {
    const day = toLocalDateString(entry.started_at, timezone);
    perDaySeconds.set(day, (perDaySeconds.get(day) ?? 0) + timeEntrySeconds(entry));
  }
  const hoursPerDayData = eachDateInRange(from, to).map((date) => ({
    date,
    hours: (perDaySeconds.get(date) ?? 0) / 3600,
  }));

  // 2. Top requesters — most-recently-seen sender_name wins as the label.
  const requesterStats = new Map<string, { name: string | null; count: number }>();
  for (const ticket of [...filtered].sort(
    (a, b) => new Date(a.received_at).getTime() - new Date(b.received_at).getTime(),
  )) {
    const existing = requesterStats.get(ticket.sender_email);
    requesterStats.set(ticket.sender_email, {
      name: ticket.sender_name,
      count: (existing?.count ?? 0) + 1,
    });
  }
  const topRequesters = [...requesterStats.entries()]
    .map(([email, { name, count }]) => ({ email, name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // 3. Most common issues — free-text category, case/whitespace-normalized.
  const categoryStats = new Map<string, number>();
  for (const ticket of filtered) {
    const key = ticket.category?.trim().toLowerCase() || "uncategorized";
    categoryStats.set(key, (categoryStats.get(key) ?? 0) + 1);
  }
  const categoryData = [...categoryStats.entries()]
    .map(([key, count]) => ({
      label: key === "uncategorized" ? t("reports.uncategorized") : titleCase(key),
      count,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // 4. Tickets by status.
  const statusCounts = new Map<string, number>();
  for (const ticket of filtered) {
    statusCounts.set(ticket.status, (statusCounts.get(ticket.status) ?? 0) + 1);
  }
  const statusData = STATUS_VALUES.map((status) => ({
    status,
    label: t(`status.${status}`),
    count: statusCounts.get(status) ?? 0,
  }));

  // 5. Tickets by day of week (company-local calendar day).
  const weekdayCounts = new Array(7).fill(0);
  for (const ticket of filtered) {
    weekdayCounts[localWeekdayIndex(ticket.received_at, timezone)] += 1;
  }
  const labels = weekdayLabels(locale);
  const dayOfWeekData = weekdayCounts.map((count, i) => ({ label: labels[i], count }));

  // 6. Tickets by hour of day (company-local hour the ticket was received).
  const hourCounts = new Array(24).fill(0);
  for (const ticket of filtered) {
    hourCounts[localHourIndex(ticket.received_at, timezone)] += 1;
  }
  const hourLabelValues = hourLabels(locale);
  const hourOfDayData = hourCounts.map((count, i) => ({ label: hourLabelValues[i], count }));

  const topRequestersData = topRequesters.map((r) => ({
    label: r.name || r.email,
    count: r.count,
  }));

  return (
    <div className="space-y-6">
      <h1 className="text-[22px] font-extrabold tracking-tight text-ink md:text-[27px]">
        {t("reports.title")}
      </h1>

      <DateRangeFilter t={t} basePath="/dashboard/reports" from={params.from} to={params.to} />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <ReportCard title={t("reports.perDayTitle")} hasData={filtered.length > 0} t={t}>
          <TicketsPerDayChart data={perDayData} />
        </ReportCard>

        <ReportCard
          title={t("reports.hoursPerDayTitle")}
          hasData={hoursPerDayData.some((d) => d.hours > 0)}
          t={t}
        >
          <HoursPerDayChart data={hoursPerDayData} />
        </ReportCard>

        <ReportCard title={t("reports.statusTitle")} hasData={filtered.length > 0} t={t}>
          <StatusBreakdownChart data={statusData} />
        </ReportCard>

        <ReportCard title={t("reports.topRequestersTitle")} hasData={topRequestersData.length > 0} t={t}>
          <HorizontalBarChart data={topRequestersData} color="var(--color-info)" />
          <div className="mt-4 overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-start text-[13px]">
              <thead>
                <tr className="divide-x divide-border border-b border-border">
                  <th className="px-3 py-2 text-[11px] font-bold tracking-wide text-ink-sub uppercase">
                    {t("reports.topRequestersTable.requester")}
                  </th>
                  <th className="px-3 py-2 text-[11px] font-bold tracking-wide text-ink-sub uppercase">
                    {t("reports.topRequestersTable.email")}
                  </th>
                  <th className="px-3 py-2 text-[11px] font-bold tracking-wide text-ink-sub uppercase">
                    {t("reports.topRequestersTable.tickets")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {topRequesters.map((r) => (
                  <tr key={r.email} className="divide-x divide-border border-b border-border last:border-0">
                    <td className="px-3 py-2 font-medium text-ink">{r.name || "—"}</td>
                    <td className="px-3 py-2 text-ink-sub">{r.email}</td>
                    <td className="px-3 py-2 text-ink-sub">{r.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ReportCard>

        <ReportCard title={t("reports.categoryTitle")} hasData={categoryData.length > 0} t={t}>
          <HorizontalBarChart data={categoryData} color="var(--color-accent)" />
        </ReportCard>

        <ReportCard title={t("reports.dayOfWeekTitle")} hasData={filtered.length > 0} t={t}>
          <DayOfWeekChart data={dayOfWeekData} />
        </ReportCard>

        <ReportCard title={t("reports.hourOfDayTitle")} hasData={filtered.length > 0} t={t}>
          <HourOfDayChart data={hourOfDayData} />
        </ReportCard>
      </div>
    </div>
  );
}
