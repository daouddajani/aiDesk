"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { updateSurveyEmail } from "./actions";
import { SubmitButton } from "@/components/SubmitButton";
import {
  MAX_SURVEY_EMAIL_BODY_LENGTH,
  MAX_SURVEY_LINK_TEXT_LENGTH,
} from "@/lib/surveyFaces";

export function SurveyEmailForm({ body, linkText }: { body: string; linkText: string }) {
  const t = useTranslations("surveyBuilder.email");
  const [state, formAction] = useActionState(updateSurveyEmail, undefined);

  return (
    <form
      action={formAction}
      className="space-y-4 rounded-2xl border border-border bg-surface p-5 shadow-card"
    >
      <h2 className="text-base font-bold text-ink">{t("title")}</h2>

      <div className="space-y-1">
        <label htmlFor="surveyEmailBody" className="text-sm">
          {t("bodyLabel")}
        </label>
        <textarea
          id="surveyEmailBody"
          name="body"
          rows={5}
          maxLength={MAX_SURVEY_EMAIL_BODY_LENGTH}
          defaultValue={body}
          className="w-full rounded-[10px] border border-border bg-surface-alt px-3.5 py-2.5 text-[13.5px] text-ink"
        />
        <p className="text-xs font-semibold text-ink-sub">{t("bodyHint")}</p>
      </div>

      <div className="space-y-1">
        <label htmlFor="surveyLinkText" className="text-sm">
          {t("linkTextLabel")}
        </label>
        <input
          id="surveyLinkText"
          name="linkText"
          maxLength={MAX_SURVEY_LINK_TEXT_LENGTH}
          defaultValue={linkText}
          className="w-full rounded-[10px] border border-border bg-surface-alt px-3.5 py-2.5 text-[13.5px] text-ink"
        />
        <p className="text-xs font-semibold text-ink-sub">{t("linkTextHint")}</p>
      </div>

      {state?.error && <p className="text-sm text-danger">{state.error}</p>}
      {state?.success && <p className="text-sm text-success">{t("saved")}</p>}

      <SubmitButton className="rounded-[10px] bg-primary px-4 py-2.5 text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-50">
        {t("save")}
      </SubmitButton>
    </form>
  );
}
