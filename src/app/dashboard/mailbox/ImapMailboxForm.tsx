"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { connectImapMailbox } from "./actions";
import { SubmitButton } from "@/components/SubmitButton";

export function ImapMailboxForm() {
  const t = useTranslations("mailbox.imapForm");
  const [state, formAction] = useActionState(connectImapMailbox, undefined);

  return (
    <form
      action={formAction}
      className="grid gap-3 rounded-2xl border border-border bg-surface p-4 shadow-card"
    >
      <h3 className="text-sm font-semibold">{t("title")}</h3>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label htmlFor="imapHost" className="text-xs font-semibold text-ink-sub">
            {t("imapHost")}
          </label>
          <input
            id="imapHost"
            name="imapHost"
            required
            placeholder="imap.example.com"
            className="w-full rounded-[10px] border border-border bg-surface-alt px-3.5 py-2.5 text-[13.5px] text-ink"
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="imapPort" className="text-xs font-semibold text-ink-sub">
            {t("imapPort")}
          </label>
          <input
            id="imapPort"
            name="imapPort"
            type="number"
            defaultValue={993}
            required
            className="w-full rounded-[10px] border border-border bg-surface-alt px-3.5 py-2.5 text-[13.5px] text-ink"
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="smtpHost" className="text-xs font-semibold text-ink-sub">
            {t("smtpHost")}
          </label>
          <input
            id="smtpHost"
            name="smtpHost"
            required
            placeholder="smtp.example.com"
            className="w-full rounded-[10px] border border-border bg-surface-alt px-3.5 py-2.5 text-[13.5px] text-ink"
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="smtpPort" className="text-xs font-semibold text-ink-sub">
            {t("smtpPort")}
          </label>
          <input
            id="smtpPort"
            name="smtpPort"
            type="number"
            defaultValue={465}
            required
            className="w-full rounded-[10px] border border-border bg-surface-alt px-3.5 py-2.5 text-[13.5px] text-ink"
          />
        </div>
      </div>

      <div className="space-y-1">
        <label htmlFor="username" className="text-xs font-semibold text-ink-sub">
          {t("username")}
        </label>
        <input
          id="username"
          name="username"
          required
          className="w-full rounded-[10px] border border-border bg-surface-alt px-3.5 py-2.5 text-[13.5px] text-ink"
        />
      </div>

      <div className="space-y-1">
        <label htmlFor="password" className="text-xs font-semibold text-ink-sub">
          {t("password")}
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          className="w-full rounded-[10px] border border-border bg-surface-alt px-3.5 py-2.5 text-[13.5px] text-ink"
        />
      </div>

      {state?.error && <p className="text-sm text-danger">{state.error}</p>}

      <SubmitButton>{t("submit")}</SubmitButton>
    </form>
  );
}
