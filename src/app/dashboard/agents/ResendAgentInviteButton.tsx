"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { inviteAgent } from "./actions";
import { SubmitButton } from "@/components/SubmitButton";

export function ResendAgentInviteButton({ email }: { email: string }) {
  const t = useTranslations("agents.resendInvite");
  const [state, formAction] = useActionState(inviteAgent, undefined);

  if (state?.success) {
    return <span className="text-sm text-success">{t("success")}</span>;
  }

  return (
    <form action={formAction} className="flex items-center gap-2">
      <input type="hidden" name="agentEmail" value={email} />
      <SubmitButton className="rounded-[10px] border border-border bg-surface px-2.5 py-1 text-xs font-semibold whitespace-nowrap text-ink hover:bg-surface-alt disabled:opacity-50">
        {t("submit")}
      </SubmitButton>
      {state?.error && (
        <span className="text-sm text-danger">{state.error}</span>
      )}
    </form>
  );
}
