"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { submitSurvey } from "../actions";
import { SubmitButton } from "@/components/SubmitButton";
import { SURVEY_FACES } from "@/lib/surveyFaces";

export function SurveyForm({
  token,
  questions,
}: {
  token: string;
  questions: { id: string; text: string }[];
}) {
  const t = useTranslations("surveyPublic");
  const [state, formAction] = useActionState(submitSurvey, undefined);
  // Controlled so a validation error doesn't wipe the customer's picks.
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [comment, setComment] = useState("");

  if (state?.success) {
    return <p className="py-6 text-center text-sm font-semibold text-ink">{t("thanks")}</p>;
  }

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="token" value={token} />

      {questions.map((q, i) => (
        <fieldset key={q.id} className="space-y-2">
          <legend className="text-sm font-semibold text-ink">
            {i + 1}. {q.text}
          </legend>
          <div className="flex justify-between gap-1 sm:justify-start sm:gap-3">
            {SURVEY_FACES.map((face, index) => {
              const rating = index + 1;
              return (
                <label
                  key={rating}
                  title={t(`faces.${rating}`)}
                  className="flex h-12 w-12 cursor-pointer items-center justify-center rounded-full border-2 border-transparent text-[28px] opacity-50 grayscale transition hover:opacity-100 hover:grayscale-0 has-[:checked]:border-primary has-[:checked]:opacity-100 has-[:checked]:grayscale-0 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-primary"
                >
                  <input
                    type="radio"
                    name={`q_${q.id}`}
                    value={rating}
                    required
                    checked={ratings[q.id] === rating}
                    onChange={() => setRatings((r) => ({ ...r, [q.id]: rating }))}
                    className="sr-only"
                  />
                  <span aria-hidden="true">{face}</span>
                  <span className="sr-only">{t(`faces.${rating}`)}</span>
                </label>
              );
            })}
          </div>
        </fieldset>
      ))}

      <div className="space-y-1">
        <label htmlFor="comment" className="text-sm font-semibold text-ink">
          {t("commentLabel")}
        </label>
        <textarea
          id="comment"
          name="comment"
          rows={4}
          maxLength={2000}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder={t("commentPlaceholder")}
          className="w-full rounded-[10px] border border-border bg-surface-alt px-3.5 py-2.5 text-[13.5px] text-ink"
        />
      </div>

      {state?.error && <p className="text-sm text-danger">{state.error}</p>}

      <SubmitButton>{t("submit")}</SubmitButton>
    </form>
  );
}
