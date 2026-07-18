"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { disconnectMailbox } from "./actions";
import { SubmitButton } from "@/components/SubmitButton";

export function DisconnectMailboxButton() {
  const t = useTranslations("mailbox.disconnect");
  const [state, formAction] = useActionState(disconnectMailbox, undefined);

  return (
    <form action={formAction} className="space-y-2">
      {state?.error && <p className="text-sm text-danger">{state.error}</p>}
      <SubmitButton>{t("submit")}</SubmitButton>
    </form>
  );
}
