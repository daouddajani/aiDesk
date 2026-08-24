"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";

async function requireCompanyMember() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, company_id, disabled")
    .eq("id", user.id)
    .single();

  if (
    (profile?.role !== "company_admin" && profile?.role !== "company_agent") ||
    !profile.company_id ||
    profile.disabled
  ) {
    return null;
  }

  return { supabase, userId: user.id, companyId: profile.company_id };
}

export async function deleteReminder(_prevState: unknown, formData: FormData) {
  const t = await getTranslations("reminders.delete.errors");
  const ctx = await requireCompanyMember();
  if (!ctx) return { error: t("unauthorized") };

  const reminderId = String(formData.get("reminderId") ?? "");
  if (!reminderId) return { error: t("reminderMissing") };

  const { error } = await ctx.supabase
    .from("reminders")
    .delete()
    .eq("id", reminderId)
    .eq("agent_id", ctx.userId)
    .eq("company_id", ctx.companyId);

  if (error) return { error: t("failed") };

  revalidatePath("/dashboard/reminders");
  return { success: true };
}
