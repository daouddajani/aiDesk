"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { updateCompanySettings } from "./actions";
import { SubmitButton } from "@/components/SubmitButton";
import { ME_TIMEZONES } from "@/lib/timezones";

type Company = {
  name: string;
  logo_url: string | null;
  timezone: string;
  default_agent_id: string | null;
  blocked_sender_emails: string[] | null;
  new_ticket_notification_enabled: boolean;
  new_ticket_notification_email: string | null;
};

type AgentOption = {
  id: string;
  name: string;
};

export function CompanySettingsForm({
  company,
  agentOptions,
}: {
  company: Company;
  agentOptions: AgentOption[];
}) {
  const t = useTranslations("settings");
  const tCommon = useTranslations("common");
  const [state, formAction] = useActionState(updateCompanySettings, undefined);

  return (
    <form
      action={formAction}
      className="grid max-w-lg gap-4 rounded-2xl border border-border bg-surface p-6 shadow-card"
    >
      <h1 className="text-lg font-semibold">{t("title")}</h1>

      <div className="space-y-1">
        <label htmlFor="name" className="text-sm">
          {t("name")}
        </label>
        <input
          id="name"
          name="name"
          required
          defaultValue={company.name}
          className="w-full rounded-[10px] border border-border bg-surface-alt px-3.5 py-2.5 text-[13.5px] text-ink"
        />
      </div>

      <div className="space-y-1">
        <label htmlFor="logoUrl" className="text-sm">
          {t("logoUrl")}
        </label>
        <input
          id="logoUrl"
          name="logoUrl"
          type="url"
          defaultValue={company.logo_url ?? ""}
          className="w-full rounded-[10px] border border-border bg-surface-alt px-3.5 py-2.5 text-[13.5px] text-ink"
        />
      </div>

      <div className="space-y-1">
        <label htmlFor="timezone" className="text-sm">
          {t("timezone")}
        </label>
        <select
          id="timezone"
          name="timezone"
          defaultValue={company.timezone}
          className="w-full rounded-[10px] border border-border bg-surface-alt px-3.5 py-2.5 text-[13.5px] text-ink"
        >
          {ME_TIMEZONES.map((tz) => (
            <option key={tz.value} value={tz.value}>
              {tz.label}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1">
        <label htmlFor="defaultAgentId" className="text-sm">
          {t("defaultAgent")}
        </label>
        <select
          id="defaultAgentId"
          name="defaultAgentId"
          defaultValue={company.default_agent_id ?? ""}
          className="w-full rounded-[10px] border border-border bg-surface-alt px-3.5 py-2.5 text-[13.5px] text-ink"
        >
          <option value="">{tCommon("none")}</option>
          {agentOptions.map((agent) => (
            <option key={agent.id} value={agent.id}>
              {agent.name}
            </option>
          ))}
        </select>
        <p className="text-xs font-semibold text-ink-sub">{t("defaultAgentHint")}</p>
      </div>

      <div className="space-y-1">
        <label htmlFor="blockedSenderEmails" className="text-sm">
          {t("blockedSenderEmails")}
        </label>
        <input
          id="blockedSenderEmails"
          name="blockedSenderEmails"
          defaultValue={(company.blocked_sender_emails ?? []).join(", ")}
          placeholder={t("blockedSenderEmailsPlaceholder")}
          className="w-full rounded-[10px] border border-border bg-surface-alt px-3.5 py-2.5 text-[13.5px] text-ink"
        />
        <p className="text-xs font-semibold text-ink-sub">
          {t("blockedSenderEmailsHint")}
        </p>
      </div>

      <div className="space-y-2">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="newTicketNotificationEnabled"
            defaultChecked={company.new_ticket_notification_enabled}
            className="h-4 w-4 rounded border-border"
          />
          {t("newTicketNotificationEnabledLabel")}
        </label>
        <input
          id="newTicketNotificationEmail"
          name="newTicketNotificationEmail"
          type="email"
          defaultValue={company.new_ticket_notification_email ?? ""}
          placeholder={t("newTicketNotificationEmailPlaceholder")}
          className="w-full rounded-[10px] border border-border bg-surface-alt px-3.5 py-2.5 text-[13.5px] text-ink"
        />
        <p className="text-xs font-semibold text-ink-sub">
          {t("newTicketNotificationEmailHint")}
        </p>
      </div>

      {state?.error && <p className="text-sm text-danger">{state.error}</p>}
      {state?.success && (
        <p className="text-sm text-success">{t("success")}</p>
      )}

      <SubmitButton>{tCommon("saveChanges")}</SubmitButton>
    </form>
  );
}
