"use server";

import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { setLocaleCookie } from "@/lib/locale";
import type { Locale } from "@/i18n/request";

export async function updatePassword(_prevState: unknown, formData: FormData) {
  const t = await getTranslations("updatePassword.errors");
  const password = String(formData.get("password") ?? "");

  if (password.length < 8) {
    return { error: t("tooShort") };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    return { error: t("failed") };
  }

  const { data } = await supabase.auth.getUser();
  const { data: profile } = data.user
    ? await supabase
        .from("profiles")
        .select("role, locale")
        .eq("id", data.user.id)
        .single()
    : { data: null };

  await setLocaleCookie((profile?.locale as Locale) ?? "en");

  redirect(profile?.role === "super_admin" ? "/admin" : "/dashboard");
}
