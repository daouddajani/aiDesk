"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { updateProfile } from "./actions";
import { SubmitButton } from "@/components/SubmitButton";

export function ProfileForm({
  fullName,
  locale,
  autoRefreshEnabled,
  autoRefreshIntervalMinutes,
}: {
  fullName: string | null;
  locale: string;
  autoRefreshEnabled: boolean;
  autoRefreshIntervalMinutes: number;
}) {
  const t = useTranslations("profile");
  const [state, formAction] = useActionState(updateProfile, undefined);
  const [autoRefresh, setAutoRefresh] = useState(autoRefreshEnabled);

  return (
    <form
      action={formAction}
      className="grid max-w-md gap-4 rounded-2xl border border-border bg-surface p-6 shadow-card"
    >
      <h1 className="text-lg font-semibold">{t("title")}</h1>

      <div className="space-y-1">
        <label htmlFor="fullName" className="text-sm">
          {t("fullName")}
        </label>
        <input
          id="fullName"
          name="fullName"
          defaultValue={fullName ?? ""}
          className="w-full rounded-[10px] border border-border bg-surface-alt px-3.5 py-2.5 text-[13.5px] text-ink"
        />
      </div>

      <div className="space-y-1">
        <label htmlFor="language" className="text-sm">
          {t("language")}
        </label>
        <select
          id="language"
          name="language"
          defaultValue={locale}
          className="w-full rounded-[10px] border border-border bg-surface-alt px-3.5 py-2.5 text-[13.5px] text-ink"
        >
          <option value="en">{t("languageEnglish")}</option>
          <option value="ar">{t("languageArabic")}</option>
        </select>
      </div>

      <div className="space-y-2">
        <label className="flex items-center gap-2.5 text-sm">
          <input
            type="checkbox"
            name="autoRefreshEnabled"
            defaultChecked={autoRefreshEnabled}
            onChange={(e) => setAutoRefresh(e.target.checked)}
            className="h-4 w-4 rounded border-border"
          />
          {t("autoRefreshLabel")}
        </label>

        {autoRefresh && (
          <div className="space-y-1">
            <label htmlFor="autoRefreshIntervalMinutes" className="text-sm">
              {t("autoRefreshIntervalLabel")}
            </label>
            <input
              id="autoRefreshIntervalMinutes"
              name="autoRefreshIntervalMinutes"
              type="number"
              min={1}
              max={60}
              defaultValue={autoRefreshIntervalMinutes}
              className="w-full rounded-[10px] border border-border bg-surface-alt px-3.5 py-2.5 text-[13.5px] text-ink"
            />
          </div>
        )}
      </div>

      {state?.error && <p className="text-sm text-danger">{state.error}</p>}
      {state?.success && (
        <p className="text-sm text-success">{t("success")}</p>
      )}

      <SubmitButton>{t("submit")}</SubmitButton>
    </form>
  );
}
