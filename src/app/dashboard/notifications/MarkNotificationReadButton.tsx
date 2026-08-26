"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { markNotificationRead } from "./actions";
import { SubmitButton } from "@/components/SubmitButton";

export function MarkNotificationReadButton({
  notificationId,
}: {
  notificationId: string;
}) {
  const t = useTranslations("notificationsPage.markRead");
  const [state, formAction] = useActionState(markNotificationRead, undefined);

  return (
    <form action={formAction} className="flex items-center gap-2">
      <input type="hidden" name="notificationId" value={notificationId} />
      <SubmitButton className="rounded-[10px] border border-border bg-surface px-2.5 py-1 text-xs font-semibold whitespace-nowrap text-ink transition-colors hover:bg-surface-alt disabled:opacity-50">
        {t("submit")}
      </SubmitButton>
      {state?.error && <span className="text-sm text-danger">{state.error}</span>}
    </form>
  );
}
