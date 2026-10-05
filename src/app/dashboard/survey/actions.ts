"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import {
  DEFAULT_SURVEY_EMAIL_BODY,
  DEFAULT_SURVEY_LINK_TEXT,
  MAX_SURVEY_EMAIL_BODY_LENGTH,
  MAX_SURVEY_LINK_TEXT_LENGTH,
} from "@/lib/surveyFaces";

const MAX_QUESTION_LENGTH = 300;

async function requireCompanyAdmin() {
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

  if (profile?.role !== "company_admin" || !profile.company_id || profile.disabled) {
    return null;
  }

  return { supabase, companyId: profile.company_id };
}

async function activeQuestions(
  ctx: NonNullable<Awaited<ReturnType<typeof requireCompanyAdmin>>>,
) {
  const { data } = await ctx.supabase
    .from("survey_questions")
    .select("id, position")
    .eq("company_id", ctx.companyId)
    .is("archived_at", null)
    .order("position", { ascending: true })
    .order("created_at", { ascending: true });
  return data ?? [];
}

export async function addQuestion(_prevState: unknown, formData: FormData) {
  const t = await getTranslations("surveyBuilder.errors");
  const ctx = await requireCompanyAdmin();
  if (!ctx) return { error: t("unauthorized") };

  const text = String(formData.get("text") ?? "").trim();
  if (!text) return { error: t("textRequired") };
  if (text.length > MAX_QUESTION_LENGTH) return { error: t("textTooLong") };

  const questions = await activeQuestions(ctx);
  const nextPosition =
    questions.length > 0 ? questions[questions.length - 1].position + 1 : 0;

  const { error } = await ctx.supabase.from("survey_questions").insert({
    company_id: ctx.companyId,
    text,
    position: nextPosition,
  });
  if (error) return { error: t("failed") };

  revalidatePath("/dashboard/survey");
  return { success: true };
}

export async function updateQuestion(_prevState: unknown, formData: FormData) {
  const t = await getTranslations("surveyBuilder.errors");
  const ctx = await requireCompanyAdmin();
  if (!ctx) return { error: t("unauthorized") };

  const questionId = String(formData.get("questionId") ?? "");
  const text = String(formData.get("text") ?? "").trim();
  if (!questionId) return { error: t("failed") };
  if (!text) return { error: t("textRequired") };
  if (text.length > MAX_QUESTION_LENGTH) return { error: t("textTooLong") };

  const { error } = await ctx.supabase
    .from("survey_questions")
    .update({ text })
    .eq("id", questionId);
  if (error) return { error: t("failed") };

  revalidatePath("/dashboard/survey");
  return { success: true };
}

// Archived rather than deleted, so past answers to it stay on the results page.
export async function archiveQuestion(_prevState: unknown, formData: FormData) {
  const t = await getTranslations("surveyBuilder.errors");
  const ctx = await requireCompanyAdmin();
  if (!ctx) return { error: t("unauthorized") };

  const questionId = String(formData.get("questionId") ?? "");
  if (!questionId) return { error: t("failed") };

  const { error } = await ctx.supabase
    .from("survey_questions")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", questionId);
  if (error) return { error: t("failed") };

  revalidatePath("/dashboard/survey");
  return { success: true };
}

export async function moveQuestion(_prevState: unknown, formData: FormData) {
  const t = await getTranslations("surveyBuilder.errors");
  const ctx = await requireCompanyAdmin();
  if (!ctx) return { error: t("unauthorized") };

  const questionId = String(formData.get("questionId") ?? "");
  const direction = formData.get("direction") === "up" ? -1 : 1;

  const questions = await activeQuestions(ctx);
  const index = questions.findIndex((q) => q.id === questionId);
  const swapWith = questions[index + direction];
  if (index === -1 || !swapWith) return { success: true };

  // Renumber everything by index so legacy/duplicate positions can't leave
  // the swap a no-op.
  const reordered = [...questions];
  reordered[index] = swapWith;
  reordered[index + direction] = questions[index];
  const results = await Promise.all(
    reordered.map((q, position) =>
      ctx.supabase.from("survey_questions").update({ position }).eq("id", q.id),
    ),
  );
  if (results.some((r) => r.error)) return { error: t("failed") };

  revalidatePath("/dashboard/survey");
  return { success: true };
}

export async function updateSurveyEmail(_prevState: unknown, formData: FormData) {
  const t = await getTranslations("surveyBuilder.email.errors");
  const ctx = await requireCompanyAdmin();
  if (!ctx) return { error: t("unauthorized") };

  const body = String(formData.get("body") ?? "").trim();
  const linkText = String(formData.get("linkText") ?? "").trim();
  if (body.length > MAX_SURVEY_EMAIL_BODY_LENGTH) return { error: t("bodyTooLong") };
  if (linkText.length > MAX_SURVEY_LINK_TEXT_LENGTH) return { error: t("linkTextTooLong") };

  // Empty — or unchanged from the default — is stored as null, so the
  // company keeps tracking the default wording.
  const { error } = await ctx.supabase
    .from("companies")
    .update({
      survey_email_body: body && body !== DEFAULT_SURVEY_EMAIL_BODY ? body : null,
      survey_email_link_text:
        linkText && linkText !== DEFAULT_SURVEY_LINK_TEXT ? linkText : null,
    })
    .eq("id", ctx.companyId);
  if (error) return { error: t("failed") };

  revalidatePath("/dashboard/survey");
  return { success: true };
}
