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
    (profile?.role !== "company_admin" &&
      profile?.role !== "company_agent" &&
      profile?.role !== "supervisor") ||
    !profile.company_id ||
    profile.disabled
  ) {
    return null;
  }

  return { supabase, userId: user.id, companyId: profile.company_id };
}

export async function markNotificationRead(
  _prevState: unknown,
  formData: FormData,
) {
  const t = await getTranslations("notificationsPage.errors");
  const ctx = await requireCompanyMember();
  if (!ctx) return { error: t("unauthorized") };

  const notificationId = String(formData.get("notificationId") ?? "");
  if (!notificationId) return { error: t("notificationMissing") };

  const { error } = await ctx.supabase
    .from("ticket_notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", notificationId)
    .eq("agent_id", ctx.userId)
    .eq("company_id", ctx.companyId);

  if (error) return { error: t("failed") };

  revalidatePath("/dashboard/notifications");
  return { success: true };
}

export async function markAllNotificationsRead(
  _prevState: unknown,
  _formData: FormData,
) {
  const t = await getTranslations("notificationsPage.errors");
  const ctx = await requireCompanyMember();
  if (!ctx) return { error: t("unauthorized") };

  const { error } = await ctx.supabase
    .from("ticket_notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("agent_id", ctx.userId)
    .eq("company_id", ctx.companyId)
    .is("read_at", null);

  if (error) return { error: t("failed") };

  revalidatePath("/dashboard/notifications");
  return { success: true };
}
