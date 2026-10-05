"use server";

import { getTranslations } from "next-intl/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkRateLimit } from "@/lib/rateLimit";

const MAX_COMMENT_LENGTH = 2000;

// Public, unauthenticated action — the token is the only credential, so
// every check happens here against the service-role client.
export async function submitSurvey(_prevState: unknown, formData: FormData) {
  const t = await getTranslations("surveyPublic.errors");
  const token = String(formData.get("token") ?? "");
  if (!/^[0-9a-f]{64}$/.test(token)) return { error: t("invalid") };

  if (!(await checkRateLimit(`survey:${token}`, 10, 60))) {
    return { error: t("rateLimited") };
  }

  const admin = createAdminClient();
  const { data: response } = await admin
    .from("survey_responses")
    .select("id, company_id, submitted_at")
    .eq("token", token)
    .maybeSingle();
  if (!response) return { error: t("invalid") };
  if (response.submitted_at) return { error: t("alreadySubmitted") };

  const { data: questions } = await admin
    .from("survey_questions")
    .select("id")
    .eq("company_id", response.company_id)
    .is("archived_at", null);

  const answers = [];
  for (const q of questions ?? []) {
    const rating = Number(formData.get(`q_${q.id}`));
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return { error: t("answerAll") };
    }
    answers.push({
      response_id: response.id,
      question_id: q.id,
      company_id: response.company_id,
      rating,
    });
  }

  const comment = String(formData.get("comment") ?? "")
    .trim()
    .slice(0, MAX_COMMENT_LENGTH);

  // Claim the response first — the conditional update means a double
  // submit can only ever win once.
  const { data: claimed } = await admin
    .from("survey_responses")
    .update({ submitted_at: new Date().toISOString(), comment: comment || null })
    .eq("id", response.id)
    .is("submitted_at", null)
    .select("id");
  if (!claimed?.length) return { error: t("alreadySubmitted") };

  if (answers.length > 0) {
    const { error } = await admin.from("survey_answers").insert(answers);
    if (error) {
      // Release the claim so the customer can retry.
      await admin
        .from("survey_responses")
        .update({ submitted_at: null, comment: null })
        .eq("id", response.id);
      return { error: t("failed") };
    }
  }

  return { success: true };
}
