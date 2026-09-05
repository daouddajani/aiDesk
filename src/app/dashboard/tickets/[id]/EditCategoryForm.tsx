"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { updateTicketCategory } from "../actions";
import { SubmitButton } from "@/components/SubmitButton";

export function EditCategoryForm({
  ticketId,
  category,
}: {
  ticketId: string;
  category: string | null;
}) {
  const t = useTranslations("tickets.category");
  const [state, formAction] = useActionState(updateTicketCategory, undefined);

  return (
    <form action={formAction} className="flex items-center gap-2">
      <input type="hidden" name="ticketId" value={ticketId} />
      <input
        type="text"
        name="category"
        defaultValue={category ?? ""}
        placeholder={t("placeholder")}
        maxLength={100}
        className="min-w-0 flex-1 rounded-[10px] border border-border bg-surface-alt px-2.5 py-1.5 text-xs text-ink"
      />
      <SubmitButton className="shrink-0 rounded-[10px] border border-border bg-surface px-3 py-1.5 text-xs font-bold text-ink transition-colors hover:bg-surface-alt disabled:opacity-50">
        {t("submit")}
      </SubmitButton>
      {state?.error && <span className="text-xs text-danger">{state.error}</span>}
    </form>
  );
}
