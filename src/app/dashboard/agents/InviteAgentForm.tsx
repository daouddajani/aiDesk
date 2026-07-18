"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { inviteAgent } from "./actions";
import { SubmitButton } from "@/components/SubmitButton";

export function InviteAgentForm() {
  const t = useTranslations("agents.inviteForm");
  const [state, formAction] = useActionState(inviteAgent, undefined);

  return (
    <form
      action={formAction}
      className="grid max-w-sm gap-4 rounded-2xl border border-border bg-surface p-6 shadow-card"
    >
      <h2 className="font-semibold">{t("title")}</h2>

      <div className="space-y-1">
        <label htmlFor="agentEmail" className="text-sm">
          {t("emailLabel")}
        </label>
        <input
          id="agentEmail"
          name="agentEmail"
          type="email"
          required
          className="w-full rounded-[10px] border border-border bg-surface-alt px-3.5 py-2.5 text-[13.5px] text-ink"
        />
      </div>

      {state?.error && <p className="text-sm text-danger">{state.error}</p>}
      {state?.success && (
        <p className="text-sm text-success">{t("success")}</p>
      )}

      <SubmitButton>{t("submit")}</SubmitButton>
    </form>
  );
}
