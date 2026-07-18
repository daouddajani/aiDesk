"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOrigin } from "@/lib/url";
import { resend, RESEND_FROM_EMAIL } from "@/lib/resend";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function inviteCompanyAdminEmail(companyId: string, adminEmail: string) {
  const origin = await getOrigin();
  const adminClient = createAdminClient();

  const { data, error } = await adminClient.auth.admin.generateLink({
    type: "invite",
    email: adminEmail,
    options: {
      data: { role: "company_admin", company_id: companyId },
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

  // Build the link against our own /auth/confirm route instead of using
  // data.properties.action_link: that link points at Supabase's hosted
  // /auth/v1/verify endpoint, which redirects back with the session in a
  // URL fragment our server-side route handler can never see.
  const confirmUrl = `${origin}/auth/confirm?token_hash=${data.properties.hashed_token}&type=invite&next=/update-password`;

  const { error: sendError } = await resend.emails.send({
    from: RESEND_FROM_EMAIL,
    to: adminEmail,
    subject: `You're invited to manage ${companyName} on AI Helpdesk`,
    html: `<p>You've been invited as the Company Admin for <strong>${companyName}</strong> on AI Helpdesk.</p><p><a href="${confirmUrl}">Accept the invitation</a></p>`,
  });

  return { error: sendError ? new Error(sendError.message) : null };
}

export async function inviteCompanyAdmin(
  _prevState: unknown,
  formData: FormData,
) {
  const t = await getTranslations("admin.inviteAdminForm.errors");
  const companyId = String(formData.get("companyId") ?? "");
  const adminEmail = String(formData.get("adminEmail") ?? "").trim();

  if (!adminEmail || !EMAIL_RE.test(adminEmail)) {
    return { error: t("emailRequired") };
  }

  const { error } = await inviteCompanyAdminEmail(companyId, adminEmail);

  if (error) {
    return { error: t("inviteFailed", { message: error.message }) };
  }

  revalidatePath("/admin");
  return { success: true };
}

export async function createCompany(_prevState: unknown, formData: FormData) {
  const t = await getTranslations("admin.createCompany.errors");
  const name = String(formData.get("name") ?? "").trim();
  const adminEmail = String(formData.get("adminEmail") ?? "").trim();
  const timezone = String(formData.get("timezone") ?? "").trim() || "UTC";
  const helpdeskEmail = String(formData.get("helpdeskEmail") ?? "").trim();

  if (!name) {
    return { error: t("nameRequired") };
  }
  if (!adminEmail || !EMAIL_RE.test(adminEmail)) {
    return { error: t("adminEmailRequired") };
  }

  const supabase = await createClient();
  const { data: company, error: insertError } = await supabase
    .from("companies")
    .insert({
      name,
      timezone,
      helpdesk_email: helpdeskEmail || null,
    })
    .select("id")
    .single();

  if (insertError || !company) {
    return { error: t("createFailed") };
  }

  const { error: inviteError } = await inviteCompanyAdminEmail(
    company.id,
    adminEmail,
  );

  if (inviteError) {
    revalidatePath("/admin");
    return {
      error: t("inviteFailed", { message: inviteError.message }),
    };
  }

  revalidatePath("/admin");
  return { success: true };
}

export async function updateCompany(_prevState: unknown, formData: FormData) {
  const t = await getTranslations("admin.editCompany.errors");
  const companyId = String(formData.get("companyId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const timezone = String(formData.get("timezone") ?? "").trim() || "UTC";
  const helpdeskEmail = String(formData.get("helpdeskEmail") ?? "").trim();

  if (!companyId) {
    return { error: t("companyIdMissing") };
  }
  if (!name) {
    return { error: t("nameRequired") };
  }
  if (helpdeskEmail && !EMAIL_RE.test(helpdeskEmail)) {
    return { error: t("helpdeskEmailInvalid") };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("companies")
    .update({ name, timezone, helpdesk_email: helpdeskEmail || null })
    .eq("id", companyId);

  if (error) {
    return { error: t("updateFailed") };
  }

  revalidatePath("/admin");
  return { success: true };
}
