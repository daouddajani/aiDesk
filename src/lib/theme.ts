import { cookies } from "next/headers";

export type Theme = "light" | "dark";

export async function getThemeCookie(): Promise<Theme> {
  const cookieStore = await cookies();
  return cookieStore.get("THEME")?.value === "dark" ? "dark" : "light";
}

export async function setThemeCookie(theme: Theme) {
  const cookieStore = await cookies();
  cookieStore.set("THEME", theme, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
}
