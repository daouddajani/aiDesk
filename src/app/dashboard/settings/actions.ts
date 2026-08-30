"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { AIProviderName, CompanyAIConfig } from "@/lib/ai";

const AI_PROVIDERS: AIProviderName[] = ["openai", "anthropic", "gemini"];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeHelpdeskUrl(raw: string) {
  const trimmed = raw.trim().replace(/\/+$/, "");
  if (!trimmed) return "";
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

export async function updateCompanySettings(
  _prevState: unknown,
  formData: FormData,
) {
  const t = await getTranslations("settings.errors");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: t("unauthorized") };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, company_id")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "company_admin" || !profile.company_id) {
    return { error: t("unauthorized") };
  }

  const name = String(formData.get("name") ?? "").trim();
  const timezone = String(formData.get("timezone") ?? "").trim() || "UTC";
  const logoUrl = String(formData.get("logoUrl") ?? "").trim();
  const defaultAgentId = String(formData.get("defaultAgentId") ?? "").trim();
  const blockedSenderEmails = Array.from(
    new Set(
      String(formData.get("blockedSenderEmails") ?? "")
        .split(",")
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean),
    ),
  );

  const newTicketNotificationEnabled =
    formData.get("newTicketNotificationEnabled") === "on";
  const newTicketNotificationEmail = String(
    formData.get("newTicketNotificationEmail") ?? "",
  ).trim();
  const helpdeskUrl = normalizeHelpdeskUrl(
    String(formData.get("helpdeskUrl") ?? ""),
  );

  if (!name) {
    return { error: t("nameRequired") };
  }

  if (newTicketNotificationEmail && !EMAIL_RE.test(newTicketNotificationEmail)) {
    return { error: t("invalidNotificationEmail") };
  }
  if (newTicketNotificationEnabled && !newTicketNotificationEmail) {
    return { error: t("notificationEmailRequired") };
  }
  if (newTicketNotificationEnabled && !helpdeskUrl) {
    return { error: t("helpdeskUrlRequired") };
  }

  // Scoping to the caller's own company is enforced by the companies_update
  // RLS policy, not re-checked here.
  const { error } = await supabase
    .from("companies")
    .update({
      name,
      timezone,
      logo_url: logoUrl || null,
      default_agent_id: defaultAgentId || null,
      blocked_sender_emails: blockedSenderEmails,
      new_ticket_notification_enabled: newTicketNotificationEnabled,
      new_ticket_notification_email: newTicketNotificationEmail || null,
      helpdesk_url: helpdeskUrl || null,
    })
    .eq("id", profile.company_id);

  if (error) {
    return { error: t("updateFailed") };
  }

  revalidatePath("/dashboard/settings");
  return { success: true };
}

export async function updateAISettings(_prevState: unknown, formData: FormData) {
  const t = await getTranslations("settings.ai.errors");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: t("unauthorized") };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, company_id")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "company_admin" || !profile.company_id) {
    return { error: t("unauthorized") };
  }

  const enabled = formData.get("enabled") === "on";
  const provider = String(formData.get("provider") ?? "") as AIProviderName;
  const apiKey = String(formData.get("apiKey") ?? "").trim();
  const embeddingsApiKey = String(formData.get("embeddingsApiKey") ?? "").trim();

  if (!AI_PROVIDERS.includes(provider)) {
    return { error: t("invalidProvider") };
  }

  const { data: company } = await supabase
    .from("companies")
    .select("company_ai_config, ai_secret_id")
    .eq("id", profile.company_id)
    .single();

  const currentConfig = (company?.company_ai_config ?? {}) as CompanyAIConfig;
  const providerChanged = currentConfig.provider !== provider;
  const hasExistingKey = Boolean(company?.ai_secret_id);

  if (providerChanged && !apiKey) {
    return { error: t("keyRequiredOnProviderChange") };
  }
  if (enabled && !apiKey && !hasExistingKey) {
    return { error: t("keyRequired") };
  }

  // Scoping to the caller's own company is enforced by requireCompanyAdmin
  // above; the secret RPCs themselves take a raw company_id (service-role
  // only, not exposed to authenticated users directly), mirroring the
  // mailbox-secret pattern in dashboard/mailbox/actions.ts.
  const adminClient = createAdminClient();

  if (apiKey) {
    const { error: keyError } = await adminClient.rpc("set_company_ai_secret", {
      p_company_id: profile.company_id,
      p_secret: apiKey,
      p_provider: provider,
    });
    if (keyError) return { error: t("saveFailed") };
  }

  if (embeddingsApiKey && provider !== "openai") {
    const { error: embeddingsError } = await adminClient.rpc(
      "set_company_ai_embeddings_secret",
      { p_company_id: profile.company_id, p_secret: embeddingsApiKey },
    );
    if (embeddingsError) return { error: t("saveFailed") };
  }

  const { error } = await supabase
    .from("companies")
    .update({ company_ai_config: { enabled, provider } })
    .eq("id", profile.company_id);

  if (error) {
    return { error: t("saveFailed") };
  }

  revalidatePath("/dashboard/settings");
  return { success: true };
}
