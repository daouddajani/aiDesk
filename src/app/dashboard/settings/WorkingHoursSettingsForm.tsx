"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { updateWorkingHoursSettings } from "./actions";
import { SubmitButton } from "@/components/SubmitButton";
import type { DayOfWeekKey, WorkingHoursConfig } from "@/lib/workingHours";

const DISPLAY_ORDER: DayOfWeekKey[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

export function WorkingHoursSettingsForm({
  config,
}: {
  config: WorkingHoursConfig;
}) {
  const t = useTranslations("settings.workingHours");
  const tCommon = useTranslations("common");
  const [state, formAction] = useActionState(updateWorkingHoursSettings, undefined);

  return (
    <form
      action={formAction}
      className="grid max-w-lg gap-4 rounded-2xl border border-border bg-surface p-6 shadow-card"
    >
      <div>
        <h1 className="text-lg font-semibold">{t("title")}</h1>
        <p className="mt-1 text-[13px] text-ink-sub">{t("description")}</p>
      </div>

      <label className="flex items-center gap-2.5 text-sm">
        <input
          type="checkbox"
          name="enabled"
          defaultChecked={config.enabled ?? false}
          className="h-4 w-4 rounded border-border"
        />
        {t("enabledLabel")}
      </label>

      <div className="grid gap-2">
        {DISPLAY_ORDER.map((key) => {
          const day = config.days?.[key];
          return (
            <div
              key={key}
              className="grid grid-cols-[1fr_auto_auto] items-center gap-2.5"
            >
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name={`day_${key}_enabled`}
                  defaultChecked={day?.enabled ?? false}
                  className="h-4 w-4 rounded border-border"
                />
                {t(`days.${key}`)}
              </label>
              <input
                type="time"
                name={`day_${key}_start`}
                aria-label={t("startLabel")}
                defaultValue={day?.start ?? "09:00"}
                className="w-full rounded-[10px] border border-border bg-surface-alt px-3.5 py-2.5 text-[13.5px] text-ink"
              />
              <input
                type="time"
                name={`day_${key}_end`}
                aria-label={t("endLabel")}
                defaultValue={day?.end ?? "17:00"}
                className="w-full rounded-[10px] border border-border bg-surface-alt px-3.5 py-2.5 text-[13.5px] text-ink"
              />
            </div>
          );
        })}
      </div>

      <div className="space-y-1">
        <label htmlFor="autoReplyBody" className="text-sm">
          {t("autoReplyBodyLabel")}
        </label>
        <textarea
          id="autoReplyBody"
          name="autoReplyBody"
          rows={5}
          placeholder={t("autoReplyBodyPlaceholder")}
          defaultValue={config.autoReplyBody ?? ""}
          className="w-full resize-y rounded-[10px] border border-border bg-surface-alt px-3.5 py-2.5 text-[13.5px] text-ink placeholder:text-ink-sub"
        />
        <p className="text-xs font-semibold text-ink-sub">
          {t("autoReplyBodyHint")}
        </p>
      </div>

      {state?.error && <p className="text-sm text-danger">{state.error}</p>}
      {state?.success && <p className="text-sm text-success">{t("success")}</p>}

      <SubmitButton>{tCommon("saveChanges")}</SubmitButton>
    </form>
  );
}
