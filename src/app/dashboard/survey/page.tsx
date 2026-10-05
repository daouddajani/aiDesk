import { redirect } from "next/navigation";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import {
  AddQuestionForm,
  EditQuestionForm,
  MoveQuestionButton,
  ArchiveQuestionButton,
} from "./QuestionForms";
import { SurveyEmailForm } from "./SurveyEmailForm";
import { DEFAULT_SURVEY_EMAIL_BODY, DEFAULT_SURVEY_LINK_TEXT } from "@/lib/surveyFaces";

export default async function SurveyBuilderPage() {
  const t = await getTranslations("surveyBuilder");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, company_id")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "company_admin" || !profile.company_id) {
    redirect("/dashboard");
  }

  const [{ data: company }, { data: questions }] = await Promise.all([
    supabase
      .from("companies")
      .select("survey_enabled, survey_email_body, survey_email_link_text")
      .eq("id", profile.company_id)
      .single(),
    supabase
      .from("survey_questions")
      .select("id, text")
      .eq("company_id", profile.company_id)
      .is("archived_at", null)
      .order("position", { ascending: true })
      .order("created_at", { ascending: true }),
  ]);

  if (!company?.survey_enabled) {
    redirect("/dashboard/settings");
  }

  const rows = questions ?? [];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-[22px] font-extrabold tracking-tight text-ink md:text-[27px]">
          {t("title")}
        </h1>
        <Link
          href="/dashboard/survey/results"
          className="rounded-[10px] border border-border bg-surface px-4 py-2 text-sm font-bold text-ink hover:bg-surface-alt"
        >
          {t("viewResults")}
        </Link>
      </div>
      <p className="text-sm text-ink-sub">{t("description")}</p>

      <SurveyEmailForm
        body={company.survey_email_body ?? DEFAULT_SURVEY_EMAIL_BODY}
        linkText={company.survey_email_link_text ?? DEFAULT_SURVEY_LINK_TEXT}
      />

      <div className="space-y-4 rounded-2xl border border-border bg-surface p-5 shadow-card">
        <AddQuestionForm />

        {rows.length === 0 ? (
          <p className="py-6 text-center text-sm text-ink-sub">{t("noQuestions")}</p>
        ) : (
          <ol className="divide-y divide-border">
            {rows.map((q, i) => (
              <li key={q.id} className="flex flex-wrap items-center gap-2 py-3">
                <span className="w-6 shrink-0 text-sm font-bold text-ink-sub">{i + 1}.</span>
                <div className="min-w-0 flex-1">
                  {/* key resets the uncontrolled input when the saved text changes */}
                  <EditQuestionForm key={q.text} questionId={q.id} text={q.text} />
                </div>
                <MoveQuestionButton questionId={q.id} direction="up" disabled={i === 0} />
                <MoveQuestionButton
                  questionId={q.id}
                  direction="down"
                  disabled={i === rows.length - 1}
                />
                <ArchiveQuestionButton questionId={q.id} />
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}
