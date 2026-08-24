// Converts between a company's local wall-clock calendar day and the UTC
// instants `timestamptz` columns actually store, so "today"/"this week"/
// "this month" defaults and date-range filters follow the company's own
// calendar day, not the server's.

function offsetMinutesAt(utcMillis: number, timeZone: string): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const map: Record<string, string> = {};
  for (const part of dtf.formatToParts(new Date(utcMillis))) {
    if (part.type !== "literal") map[part.type] = part.value;
  }
  const asUTC = Date.UTC(
    Number(map.year),
    Number(map.month) - 1,
    Number(map.day),
    Number(map.hour),
    Number(map.minute),
    Number(map.second),
  );
  return (asUTC - utcMillis) / 60000;
}

/** A `YYYY-MM-DD` local wall-clock date/time in `timeZone`, as a UTC ISO instant. */
export function localDateStringToUtcISO(
  dateString: string,
  timeZone: string,
  hour = 0,
  minute = 0,
  second = 0,
  millisecond = 0,
): string {
  const [year, month, day] = dateString.split("-").map(Number);
  const guessUTC = Date.UTC(
    year,
    month - 1,
    day,
    hour,
    minute,
    second,
    millisecond,
  );
  const offset = offsetMinutesAt(guessUTC, timeZone);
  return new Date(guessUTC - offset * 60000).toISOString();
}

/** The `YYYY-MM-DD` calendar date that `date` falls on in `timeZone`. */
export function toLocalDateString(
  date: string | Date,
  timeZone: string,
): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(date));
}

/** Today's calendar date in `timeZone`. */
export function todayLocalDateString(timeZone: string): string {
  return toLocalDateString(new Date(), timeZone);
}

/** Monday of the current week, per `timeZone`'s calendar. */
export function startOfWeekLocalDateString(timeZone: string): string {
  const [year, month, day] = todayLocalDateString(timeZone)
    .split("-")
    .map(Number);
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay(); // 0=Sun..6=Sat
  const diffFromMonday = weekday === 0 ? 6 : weekday - 1;
  return toLocalDateString(
    new Date(Date.UTC(year, month - 1, day - diffFromMonday)),
    "UTC",
  );
}

/** The 1st of the current month, per `timeZone`'s calendar. */
export function startOfMonthLocalDateString(timeZone: string): string {
  return `${todayLocalDateString(timeZone).slice(0, 7)}-01`;
}

/** The calendar date `daysAgo` days before today, per `timeZone`'s calendar. */
export function daysAgoLocalDateString(
  timeZone: string,
  daysAgo: number,
): string {
  const [year, month, day] = todayLocalDateString(timeZone)
    .split("-")
    .map(Number);
  return toLocalDateString(
    new Date(Date.UTC(year, month - 1, day - daysAgo)),
    "UTC",
  );
}
