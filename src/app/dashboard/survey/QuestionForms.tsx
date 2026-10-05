"use client";

import { useActionState, useRef, useEffect } from "react";
import { useTranslations } from "next-intl";
import { addQuestion, updateQuestion, archiveQuestion, moveQuestion } from "./actions";
import { SubmitButton } from "@/components/SubmitButton";

const SMALL_BUTTON =
  "shrink-0 rounded-[10px] border border-border bg-surface px-3 py-1.5 text-xs font-bold text-ink transition-colors hover:bg-surface-alt disabled:opacity-50";

export function AddQuestionForm() {
  const t = useTranslations("surveyBuilder");
  const [state, formAction] = useActionState(addQuestion, undefined);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.success) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-wrap items-center gap-2">
      <input
        type="text"
        name="text"
        required
        maxLength={300}
        placeholder={t("newQuestionPlaceholder")}
        className="min-w-0 flex-1 rounded-[10px] border border-border bg-surface-alt px-3.5 py-2.5 text-[13.5px] text-ink"
      />
      <SubmitButton className="shrink-0 rounded-[10px] bg-primary px-4 py-2.5 text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-50">
        {t("addQuestion")}
      </SubmitButton>
      {state?.error && <p className="w-full text-xs text-danger">{state.error}</p>}
    </form>
  );
}

export function EditQuestionForm({ questionId, text }: { questionId: string; text: string }) {
  const t = useTranslations("surveyBuilder");
  const [state, formAction] = useActionState(updateQuestion, undefined);

  return (
    <form action={formAction} className="flex items-center gap-2">
      <input type="hidden" name="questionId" value={questionId} />
      <input
        type="text"
        name="text"
        required
        maxLength={300}
        defaultValue={text}
        className="min-w-0 flex-1 rounded-[10px] border border-border bg-surface-alt px-2.5 py-1.5 text-[13.5px] text-ink"
      />
      <SubmitButton className={SMALL_BUTTON}>{t("save")}</SubmitButton>
      {state?.error && <span className="text-xs text-danger">{state.error}</span>}
    </form>
  );
}

export function MoveQuestionButton({
  questionId,
  direction,
  disabled,
}: {
  questionId: string;
  direction: "up" | "down";
  disabled: boolean;
}) {
  const t = useTranslations("surveyBuilder");
  const [, formAction] = useActionState(moveQuestion, undefined);

  return (
    <form action={formAction}>
      <input type="hidden" name="questionId" value={questionId} />
      <input type="hidden" name="direction" value={direction} />
      <SubmitButton className={SMALL_BUTTON} disabled={disabled}>
        <span aria-label={direction === "up" ? t("moveUp") : t("moveDown")}>
          {direction === "up" ? "↑" : "↓"}
        </span>
      </SubmitButton>
    </form>
  );
}

export function ArchiveQuestionButton({ questionId }: { questionId: string }) {
  const t = useTranslations("surveyBuilder");
  const [state, formAction] = useActionState(archiveQuestion, undefined);

  return (
    <form action={formAction} className="flex items-center gap-2">
      <input type="hidden" name="questionId" value={questionId} />
      <SubmitButton className={`${SMALL_BUTTON} text-danger`}>{t("delete")}</SubmitButton>
      {state?.error && <span className="text-xs text-danger">{state.error}</span>}
    </form>
  );
}
