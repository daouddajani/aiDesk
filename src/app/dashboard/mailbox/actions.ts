"use server";

import { revalidatePath } from "next/cache";
import nodemailer from "nodemailer";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentImapUidNext } from "@/lib/imapPoll";

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

export async function connectImapMailbox(
  _prevState: unknown,
  formData: FormData,
) {
  const t = await getTranslations("mailbox.imapForm.errors");
  const ctx = await requireCompanyAdmin();
  if (!ctx) {
    return { error: t("unauthorized") };
  }

  const imapHost = String(formData.get("imapHost") ?? "").trim();
  const imapPort = Number(formData.get("imapPort") ?? 993);
  const smtpHost = String(formData.get("smtpHost") ?? "").trim();
  const smtpPort = Number(formData.get("smtpPort") ?? 465);
  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!imapHost || !smtpHost || !username || !password) {
    return { error: t("allFieldsRequired") };
  }
  if (
    !Number.isInteger(imapPort) ||
    imapPort <= 0 ||
    !Number.isInteger(smtpPort) ||
    smtpPort <= 0
  ) {
    return { error: t("invalidPorts") };
  }

  // Also seeds the polling cursor at the mailbox's current uidNext, so the
  // first poll only picks up mail that arrives after connecting, not the
  // entire mailbox history.
  let seedUid: number;
  try {
    seedUid = await getCurrentImapUidNext({
      host: imapHost,
      port: imapPort,
      username,
      password,
    });
  } catch {
    return { error: t("imapFailed") };
  }

  const smtpTransport = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpPort === 465,
    auth: { user: username, pass: password },
  });

  try {
    await smtpTransport.verify();
  } catch {
    return { error: t("smtpFailed") };
  }

  const adminClient = createAdminClient();
  const { error: secretError } = await adminClient.rpc(
    "set_company_mailbox_secret",
    {
      p_company_id: ctx.companyId,
      p_secret: password,
      p_mailbox_email: username,
      p_provider: "imap",
    },
  );

  if (secretError) {
    return { error: t("saveFailed") };
  }

  const { error: configError } = await ctx.supabase
    .from("companies")
    .update({
      mailbox_imap_config: { imapHost, imapPort, smtpHost, smtpPort, username },
      mailbox_last_uid: seedUid,
    })
    .eq("id", ctx.companyId);

  if (configError) {
    return { error: t("configSaveFailed") };
  }

  revalidatePath("/dashboard/mailbox");
  return { success: true };
}

export async function disconnectMailbox(
  _prevState: unknown,
  _formData: FormData,
) {
  const t = await getTranslations("mailbox.disconnect.errors");
  const ctx = await requireCompanyAdmin();
  if (!ctx) {
    return { error: t("unauthorized") };
  }

  const adminClient = createAdminClient();
  const { error } = await adminClient.rpc("clear_company_mailbox_secret", {
    p_company_id: ctx.companyId,
  });

  if (error) {
    return { error: t("failed") };
  }

  revalidatePath("/dashboard/mailbox");
  return { success: true };
}
