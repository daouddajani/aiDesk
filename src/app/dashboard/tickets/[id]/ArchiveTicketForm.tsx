"use client";

import { useActionState, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { archiveTicket } from "../actions";
import { SubmitButton } from "@/components/SubmitButton";

export function ArchiveTicketForm({ ticketId }: { ticketId: string }) {
  const t = useTranslations("tickets.archiveForm");
  const tCommon = useTranslations("common");
  const [state, formAction] = useActionState(archiveTicket, undefined);
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

          <p className="text-[13.5px] text-ink-sub">{t("confirmText")}</p>

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
