"use client";

import { useActionState, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { addComment } from "../actions";
import { SubmitButton } from "@/components/SubmitButton";

export function CommentForm({ ticketId }: { ticketId: string }) {
  const t = useTranslations("tickets.comment");
  const [state, formAction] = useActionState(addComment, undefined);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.success) {
      formRef.current?.reset();
    }
  }, [state]);

  return (
    <form
      ref={formRef}
      action={formAction}
      className="grid gap-3 rounded-xl border border-border bg-surface-alt p-4"
    >
      <input type="hidden" name="ticketId" value={ticketId} />
      <label htmlFor="comment-body" className="sr-only">
        {t("label")}
      </label>
      <textarea
        id="comment-body"
        name="body"
        required
        rows={4}
        placeholder={t("placeholder")}
        className="w-full resize-y rounded-[10px] border border-border bg-surface px-3.5 py-2.5 text-[13.5px] text-ink placeholder:text-ink-sub"
      />

      <div className="flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2 text-[13px] font-medium text-ink-sub">
          <input type="checkbox" name="isInternal" />
          {t("internalLabel")}
        </label>

        <input
          type="file"
          name="attachment"
          className="text-[13px] text-ink-sub"
        />
      </div>

      {state?.error && <p className="text-sm text-danger">{state.error}</p>}

      <div className="w-32">
        <SubmitButton>{t("submit")}</SubmitButton>
      </div>
    </form>
  );
}
