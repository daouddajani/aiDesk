"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { takeOwnership } from "../actions";
import { SubmitButton } from "@/components/SubmitButton";

export function TakeOwnershipButton({
  ticketId,
  disabled,
}: {
  ticketId: string;
  disabled: boolean;
}) {
  const t = useTranslations("tickets.takeOwnership");
  const [state, formAction] = useActionState(takeOwnership, undefined);

  return (
    <form action={formAction} className="flex items-center gap-2">
      <input type="hidden" name="ticketId" value={ticketId} />
      <SubmitButton
        disabled={disabled}
        className={`rounded-[10px] border px-4 py-2 text-[13.5px] font-bold transition-colors ${
          disabled
            ? "cursor-not-allowed border-border bg-surface-alt text-ink-sub opacity-60"
            : "border-success bg-success-soft text-success hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        }`}
      >
        {t("submit")}
      </SubmitButton>
      {state?.error && (
        <span className="text-sm text-danger">{state.error}</span>
      )}
    </form>
  );
}
