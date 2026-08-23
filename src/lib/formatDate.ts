// "en-GB" reliably formats as dd/MM/yyyy with Latin digits regardless of the
// app's active locale or the server runtime's default locale — deliberately
// not using the app's own locale here since the date format is meant to stay
// fixed in both English and Arabic UI. `timeZone` is the owning company's
// timezone (see `companies.timezone` / `getCompanyTimezone`), not the
// server's or viewer's, so every displayed timestamp reflects the company's
// own local time.
export function formatDate(date: string | Date, timeZone: string): string {
  return new Date(date).toLocaleDateString("en-GB", { timeZone });
}

export function formatDateTime(date: string | Date, timeZone: string): string {
  const d = new Date(date);
  const datePart = d.toLocaleDateString("en-GB", { timeZone });
  const timePart = d.toLocaleTimeString("en-US", {
    timeZone,
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
  return `${datePart}, ${timePart}`;
}
