"use server";

import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { setLocaleCookie } from "@/lib/locale";
import { checkRateLimit } from "@/lib/rateLimit";
import type { Locale } from "@/i18n/request";

export async function login(_prevState: unknown, formData: FormData) {
  const t = await getTranslations("login.errors");
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: t("required") };
  }

  // 5 attempts per 15 minutes per email — slows credential stuffing without
  // needing to fingerprint IPs.
  const allowed = await checkRateLimit(
    `login:${email.toLowerCase()}`,
    5,
    15 * 60,
  );
  if (!allowed) {
    return { error: t("rateLimited") };
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
