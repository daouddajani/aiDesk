"use client";

import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { formatDuration } from "@/lib/duration";

const AXIS_TICK = { fill: "var(--color-ink-sub)", fontSize: 12 };
const AXIS_LINE = { stroke: "var(--color-border)" };
const TOOLTIP_STYLE = {
  contentStyle: {
    backgroundColor: "var(--color-surface)",
    border: "1px solid var(--color-border)",
    borderRadius: 10,
    fontSize: 13,
  },
  labelStyle: { color: "var(--color-ink-sub)" },
  itemStyle: { color: "var(--color-ink)" },
};

// "YYYY-MM-DD" -> "MM/DD", compact enough for a daily-granularity X axis.
function shortDate(dateStr: unknown) {
  if (typeof dateStr !== "string") return "";
  const [, m, d] = dateStr.split("-");
  return `${m}/${d}`;
}

export function TicketsPerDayChart({
  data,
}: {
  data: { date: string; count: number }[];
}) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={data} margin={{ top: 8, right: 16, left: -16, bottom: 0 }}>
        <CartesianGrid stroke="var(--color-border)" vertical={false} />
        <XAxis
          dataKey="date"
          tickFormatter={shortDate}
          tick={AXIS_TICK}
          axisLine={AXIS_LINE}
          tickLine={false}
        />
        <YAxis allowDecimals={false} tick={AXIS_TICK} axisLine={AXIS_LINE} tickLine={false} />
        <Tooltip {...TOOLTIP_STYLE} labelFormatter={shortDate} />
        <Line
          type="monotone"
          dataKey="count"
          stroke="var(--color-primary)"
          strokeWidth={2}
          dot={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

// Fractional hours -> "Xh Xm" style label via the app-wide duration formatter.
function formatHours(hours: unknown) {
  if (typeof hours !== "number") return "";
  return formatDuration(hours * 3600);
}

export function HoursPerDayChart({
  data,
}: {
  data: { date: string; hours: number }[];
}) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={data} margin={{ top: 8, right: 16, left: -16, bottom: 0 }}>
        <CartesianGrid stroke="var(--color-border)" vertical={false} />
        <XAxis
          dataKey="date"
          tickFormatter={shortDate}
          tick={AXIS_TICK}
          axisLine={AXIS_LINE}
          tickLine={false}
        />
        <YAxis
          tickFormatter={formatHours}
          tick={AXIS_TICK}
          axisLine={AXIS_LINE}
          tickLine={false}
        />
        <Tooltip {...TOOLTIP_STYLE} labelFormatter={shortDate} formatter={formatHours} />
        <Line
          type="monotone"
          dataKey="hours"
          stroke="var(--color-warning)"
          strokeWidth={2}
          dot={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function HorizontalBarChart({
  data,
  color = "var(--color-info)",
}: {
  data: { label: string; count: number }[];
  color?: string;
}) {
  return (
    <ResponsiveContainer width="100%" height={Math.max(180, data.length * 34)}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 8, right: 24, left: 8, bottom: 0 }}
      >
        <CartesianGrid stroke="var(--color-border)" horizontal={false} />
        <XAxis type="number" allowDecimals={false} tick={AXIS_TICK} axisLine={AXIS_LINE} tickLine={false} />
        <YAxis
          type="category"
          dataKey="label"
          width={140}
          tick={AXIS_TICK}
          axisLine={AXIS_LINE}
          tickLine={false}
        />
        <Tooltip {...TOOLTIP_STYLE} />
        <Bar dataKey="count" fill={color} radius={[0, 4, 4, 0]} barSize={18} />
      </BarChart>
    </ResponsiveContainer>
  );
}

const STATUS_COLORS: Record<string, string> = {
  new: "var(--color-info)",
  pending: "var(--color-warning)",
  on_process: "var(--color-primary)",
  closed: "var(--color-ink-sub)",
};

export function StatusBreakdownChart({
  data,
}: {
  data: { status: string; label: string; count: number }[];
}) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 8, right: 16, left: -16, bottom: 0 }}>
        <CartesianGrid stroke="var(--color-border)" vertical={false} />
        <XAxis dataKey="label" tick={AXIS_TICK} axisLine={AXIS_LINE} tickLine={false} />
        <YAxis allowDecimals={false} tick={AXIS_TICK} axisLine={AXIS_LINE} tickLine={false} />
        <Tooltip {...TOOLTIP_STYLE} />
        <Bar dataKey="count" radius={[4, 4, 0, 0]} barSize={40}>
          {data.map((entry) => (
            <Cell key={entry.status} fill={STATUS_COLORS[entry.status] ?? "var(--color-primary)"} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function DayOfWeekChart({
  data,
}: {
  data: { label: string; count: number }[];
}) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 8, right: 16, left: -16, bottom: 0 }}>
        <CartesianGrid stroke="var(--color-border)" vertical={false} />
        <XAxis dataKey="label" tick={AXIS_TICK} axisLine={AXIS_LINE} tickLine={false} />
        <YAxis allowDecimals={false} tick={AXIS_TICK} axisLine={AXIS_LINE} tickLine={false} />
        <Tooltip {...TOOLTIP_STYLE} />
        <Bar dataKey="count" fill="var(--color-success)" radius={[4, 4, 0, 0]} barSize={32} />
      </BarChart>
    </ResponsiveContainer>
  );
}
