// "en-GB" reliably formats as dd/MM/yyyy with Latin digits regardless of the
// app's active locale or the server runtime's default locale — deliberately
// not using the app's own locale here since the date format is meant to stay
// fixed in both English and Arabic UI.
export function formatDate(date: string | Date): string {
  return new Date(date).toLocaleDateString("en-GB");
}

export function formatDateTime(date: string | Date): string {
  const d = new Date(date);
  const datePart = d.toLocaleDateString("en-GB");
  const timePart = d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
  return `${datePart}, ${timePart}`;
}
