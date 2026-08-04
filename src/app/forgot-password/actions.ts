"use server";

import { getTranslations } from "next-intl/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOrigin } from "@/lib/url";
import { resend, RESEND_FROM_EMAIL } from "@/lib/resend";
import { checkRateLimit } from "@/lib/rateLimit";

export async function requestPasswordReset(
  _prevState: unknown,
  formData: FormData,
) {
  const t = await getTranslations("forgotPassword.errors");
  const email = String(formData.get("email") ?? "").trim();

  if (!email) {
    return { error: t("required") };
  }

  // 3 reset requests per hour per email. Rate-limited requests still report
  // success below (same as the "no such account" case) so this can't be
  // used to detect whether an address has an account.
  const allowed = await checkRateLimit(
    `forgot-password:${email.toLowerCase()}`,
    3,
    60 * 60,
  );

  const origin = await getOrigin();
  const adminClient = createAdminClient();

  const { data, error } = allowed
    ? await adminClient.auth.admin.generateLink({
        type: "recovery",
        email,
      })
    : { data: null, error: new Error("rate limited") };

  // Only send if the account exists (generateLink errors otherwise) — but
  // always report success below, to avoid leaking which addresses have
  // accounts.
  if (!error && data) {
    // Build the link against our own /auth/confirm route instead of
    // Supabase's hosted /auth/v1/verify link: that redirects back with the
    // session in a URL fragment our server-side route handler can't read.
    const confirmUrl = `${origin}/auth/confirm?token_hash=${data.properties.hashed_token}&type=recovery&next=/update-password`;

    await resend.emails.send({
      from: RESEND_FROM_EMAIL,
      to: email,
      subject: "Reset your AI Helpdesk password",
      html: `<p>Follow the link below to reset your password.</p><p><a href="${confirmUrl}">Reset password</a></p>`,
    });
  }

  return { success: true };
}
