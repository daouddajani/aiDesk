"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { takeOwnership } from "../actions";

export function TakeOwnershipButton({ ticketId }: { ticketId: string }) {
  const t = useTranslations("tickets.takeOwnership");
  const [state, formAction] = useActionState(takeOwnership, undefined);

  return (
    <form action={formAction} className="flex items-center gap-2">
      <input type="hidden" name="ticketId" value={ticketId} />
      <button
        type="submit"
        className="rounded-[10px] border border-border bg-surface px-4 py-2 text-[13.5px] font-bold text-ink transition-colors hover:bg-surface-alt"
      >
        {t("submit")}
      </button>
      {state?.error && (
        <span className="text-sm text-danger">{state.error}</span>
      )}
    </form>
  );
}
