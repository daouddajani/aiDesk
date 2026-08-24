"use client";

import { useActionState, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { addReminder } from "../actions";
import { SubmitButton } from "@/components/SubmitButton";

export function AddReminderForm({ ticketId }: { ticketId: string }) {
  const t = useTranslations("tickets.addReminder");
  const tCommon = useTranslations("common");
  const [state, formAction] = useActionState(addReminder, undefined);
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (state?.success) {
      dialogRef.current?.close();
    }
  }, [state]);

  return (
    <>
      <button
        type="button"
        onClick={() => dialogRef.current?.showModal()}
        className="rounded-[10px] border border-border bg-surface px-4 py-2 text-[13.5px] font-bold text-ink transition-colors hover:bg-surface-alt"
      >
        {t("trigger")}
      </button>
      <dialog
        ref={dialogRef}
        className="w-full max-w-md rounded-2xl border border-border bg-surface p-6 text-ink backdrop:bg-black/40"
      >
        <form action={formAction} className="grid gap-4">
          <h2 className="font-extrabold text-ink">{t("title")}</h2>
          <input type="hidden" name="ticketId" value={ticketId} />

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label htmlFor="date" className="text-[12.5px] font-bold text-ink-sub">
                {t("dateLabel")}
              </label>
              <input
                id="date"
                name="date"
                type="date"
                required
                className="w-full rounded-[10px] border border-border bg-surface-alt px-3.5 py-2.5 text-[13.5px] text-ink"
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="time" className="text-[12.5px] font-bold text-ink-sub">
                {t("timeLabel")}
              </label>
              <input
                id="time"
                name="time"
                type="time"
                required
                className="w-full rounded-[10px] border border-border bg-surface-alt px-3.5 py-2.5 text-[13.5px] text-ink"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label htmlFor="comment" className="text-[12.5px] font-bold text-ink-sub">
              {t("commentLabel")}
            </label>
            <textarea
              id="comment"
              name="comment"
              required
              rows={3}
              placeholder={t("commentPlaceholder")}
              className="w-full resize-y rounded-[10px] border border-border bg-surface-alt px-3.5 py-2.5 text-[13.5px] text-ink placeholder:text-ink-sub"
            />
          </div>

          {state?.error && <p className="text-sm text-danger">{state.error}</p>}

          <div className="flex items-center justify-between gap-2 pt-2">
            <button
              type="button"
              onClick={() => dialogRef.current?.close()}
              className="text-sm font-semibold text-ink-sub hover:underline"
            >
              {tCommon("cancel")}
            </button>
            <div className="w-32">
              <SubmitButton>{t("submit")}</SubmitButton>
            </div>
          </div>
        </form>
      </dialog>
    </>
  );
}
