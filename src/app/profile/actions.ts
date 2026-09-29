"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { setLocaleCookie } from "@/lib/locale";
import { locales, type Locale } from "@/i18n/request";

export async function updateProfile(_prevState: unknown, formData: FormData) {
  const t = await getTranslations("profile.errors");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: t("unauthorized") };
  }

  const fullName = String(formData.get("fullName") ?? "").trim();
  const languageRaw = String(formData.get("language") ?? "en");
  const language: Locale = locales.includes(languageRaw as Locale)
    ? (languageRaw as Locale)
    : "en";

  const autoRefreshEnabled = formData.get("autoRefreshEnabled") === "on";
  const rawInterval = Number(formData.get("autoRefreshIntervalMinutes"));
  const autoRefreshIntervalMinutes = Number.isFinite(rawInterval)
    ? Math.min(60, Math.max(1, Math.round(rawInterval)))
    : 5;

  const { error } = await supabase
    .from("profiles")
    .update({
      full_name: fullName || null,
      locale: language,
      auto_refresh_enabled: autoRefreshEnabled,
      auto_refresh_interval_minutes: autoRefreshIntervalMinutes,
    })
    .eq("id", user.id);

  if (error) {
    return { error: t("updateFailed") };
  }

  await setLocaleCookie(language);

  revalidatePath("/", "layout");
  return { success: true };
}
