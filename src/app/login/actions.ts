"use server";

import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { setLocaleCookie } from "@/lib/locale";
import type { Locale } from "@/i18n/request";

export async function login(_prevState: unknown, formData: FormData) {
  const t = await getTranslations("login.errors");
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: t("required") };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error || !data.user) {
    return { error: t("invalid") };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, locale")
    .eq("id", data.user.id)
    .single();

  await setLocaleCookie((profile?.locale as Locale) ?? "en");

  redirect(profile?.role === "super_admin" ? "/admin" : "/dashboard");
}
