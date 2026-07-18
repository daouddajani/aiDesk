"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { getThemeCookie, setThemeCookie } from "@/lib/theme";
import { setLocaleCookie } from "@/lib/locale";
import type { Locale } from "@/i18n/request";

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function toggleTheme() {
  const current = await getThemeCookie();
  await setThemeCookie(current === "dark" ? "light" : "dark");
  revalidatePath("/", "layout");
}

export async function toggleLocale() {
  const cookieStore = await cookies();
  const current = cookieStore.get("NEXT_LOCALE")?.value;
  const next: Locale = current === "ar" ? "en" : "ar";
  await setLocaleCookie(next);

  // Best-effort: keep the stored preference in sync with the quick topbar
  // toggle too, matching what the profile page's language field does.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    await supabase.from("profiles").update({ locale: next }).eq("id", user.id);
  }

  revalidatePath("/", "layout");
}
