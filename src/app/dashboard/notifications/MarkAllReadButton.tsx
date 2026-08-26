"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { markAllNotificationsRead } from "./actions";
import { SubmitButton } from "@/components/SubmitButton";

export function MarkAllReadButton() {
  const t = useTranslations("notificationsPage.markAllRead");
  const [state, formAction] = useActionState(
    markAllNotificationsRead,
    undefined,
  );

  return (
    <form action={formAction} className="flex items-center gap-2">
      <SubmitButton className="rounded-[10px] border border-border bg-surface px-3.5 py-2 text-xs font-semibold whitespace-nowrap text-ink transition-colors hover:bg-surface-alt disabled:opacity-50">
        {t("submit")}
      </SubmitButton>
      {state?.error && <span className="text-sm text-danger">{state.error}</span>}
    </form>
  );
}
