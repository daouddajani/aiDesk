// Per-day-of-week working hours + out-of-hours auto-reply config, stored as
// companies.working_hours_config jsonb. Mirrors CompanyAIConfig's style: all
// fields optional, cast on read, whole-object overwrite on write.

import { getLocalHourMinute, toLocalDateString } from "./timezone";

export type DayOfWeekKey = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";

export type WorkingHoursDay = {
  enabled: boolean;
  start: string; // "HH:MM", 24h
  end: string; // "HH:MM", 24h
};

export type WorkingHoursConfig = {
  enabled?: boolean;
  days?: Partial<Record<DayOfWeekKey, WorkingHoursDay>>;
  autoReplyBody?: string;
};

// Index-aligned to Date#getUTCDay() (0=Sun..6=Sat).
export const DAY_KEYS: DayOfWeekKey[] = [
  "sun",
  "mon",
  "tue",
  "wed",
  "thu",
  "fri",
  "sat",
];

export function parseHHMM(value: string): number {
  const [h, m] = value.split(":").map(Number);
  return h * 60 + m;
}

/**
 * True when `receivedAtISO` falls outside the company's configured working
 * hours, interpreted in `companyTimezone`. A disabled/absent config always
 * returns false (never send); a disabled/unconfigured day is always
 * "outside hours".
 */
export function isOutsideWorkingHours(
  config: WorkingHoursConfig | null | undefined,
  receivedAtISO: string,
  companyTimezone: string,
): boolean {
  if (!config?.enabled) return false;

  const localDateString = toLocalDateString(receivedAtISO, companyTimezone);
  const [y, m, d] = localDateString.split("-").map(Number);
  const dayKey = DAY_KEYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  const day = config.days?.[dayKey];
  if (!day || !day.enabled) return true;

  const { hour, minute } = getLocalHourMinute(receivedAtISO, companyTimezone);
  const minutesOfDay = hour * 60 + minute;

  return minutesOfDay < parseHHMM(day.start) || minutesOfDay >= parseHHMM(day.end);
}
