import { headers } from "next/headers";

// Vercel/Next.js don't set a reliable absolute origin server-side by default;
// derive it from forwarded headers so email redirect links work in every env.
export async function getOrigin() {
  const h = await headers();
  const host = h.get("host");
  const protocol = h.get("x-forwarded-proto") ?? "http";
  return `${protocol}://${host}`;
}
