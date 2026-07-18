"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOrigin } from "@/lib/url";
import { resend, RESEND_FROM_EMAIL } from "@/lib/resend";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function requireCompanyAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, company_id")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "company_admin" || !profile.company_id) {
    return null;
  }

  return { supabase, companyId: profile.company_id };
}

async function inviteAgentEmail(companyId: string, agentEmail: string) {
  const origin = await getOrigin();
  const adminClient = createAdminClient();

  const { data, error } = await adminClient.auth.admin.generateLink({
    type: "invite",
    email: agentEmail,
    options: {
      data: { role: "company_agent", company_id: companyId },
    },
  });

  if (error || !data) {
    return { error };
  }

  const { data: company } = await adminClient
    .from("companies")
    .select("name")
    .eq("id", companyId)
    .single();
  const companyName = company?.name ?? "your company";

  const confirmUrl = `${origin}/auth/confirm?token_hash=${data.properties.hashed_token}&type=invite&next=/update-password`;

  const { error: sendError } = await resend.emails.send({
    from: RESEND_FROM_EMAIL,
    to: agentEmail,
    subject: `You're invited to join ${companyName} on AI Helpdesk`,
    html: `<p>You've been invited as an agent for <strong>${companyName}</strong> on AI Helpdesk.</p><p><a href="${confirmUrl}">Accept the invitation</a></p>`,
  });

  return { error: sendError ? new Error(sendError.message) : null };
}

// Used both for the initial invite form and the resend-invite button — the
// underlying operation (regenerate link, email it) is identical either way.
export async function inviteAgent(_prevState: unknown, formData: FormData) {
  const t = await getTranslations("agents.inviteForm.errors");
  const ctx = await requireCompanyAdmin();
  if (!ctx) {
    return { error: t("unauthorized") };
  }

  const agentEmail = String(formData.get("agentEmail") ?? "").trim();
  if (!agentEmail || !EMAIL_RE.test(agentEmail)) {
    return { error: t("emailRequired") };
  }

  const { error } = await inviteAgentEmail(ctx.companyId, agentEmail);
  if (error) {
    return { error: t("inviteFailed", { message: error.message }) };
  }

  revalidatePath("/dashboard/agents");
  return { success: true };
}

export async function updateAgent(_prevState: unknown, formData: FormData) {
  const t = await getTranslations("agents.editForm.errors");
  const ctx = await requireCompanyAdmin();
  if (!ctx) {
    return { error: t("unauthorized") };
  }

  const profileId = String(formData.get("profileId") ?? "");
  const fullName = String(formData.get("fullName") ?? "").trim();
  const skills = String(formData.get("skills") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  if (!profileId) {
    return { error: t("agentMissing") };
  }

  // Scoping to the caller's own company is enforced by the profiles_update
  // RLS policy, not re-checked here.
  const { error } = await ctx.supabase
    .from("profiles")
    .update({ full_name: fullName || null, skills })
    .eq("id", profileId);

  if (error) {
    return { error: t("updateFailed") };
  }

  revalidatePath("/dashboard/agents");
  return { success: true };
}
