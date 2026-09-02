"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { updateCompanyTheme, resetCompanyTheme } from "./actions";
import { SubmitButton } from "@/components/SubmitButton";
import { DEFAULT_THEME_COLORS, type CompanyThemeConfig } from "@/lib/companyTheme";

export function ThemingForm({
  logoUrl,
  themeConfig,
}: {
  logoUrl: string | null;
  themeConfig: CompanyThemeConfig;
}) {
  const t = useTranslations("settings.theming");
  const tCommon = useTranslations("common");
  const [state, formAction] = useActionState(updateCompanyTheme, undefined);
  const [resetState, resetFormAction] = useActionState(
    resetCompanyTheme,
    undefined,
  );

  const primaryColor = themeConfig.primaryColor ?? DEFAULT_THEME_COLORS.primaryColor;
  const accentColor = themeConfig.accentColor ?? DEFAULT_THEME_COLORS.accentColor;

  return (
    <div className="grid max-w-lg gap-6">
      <form
        action={formAction}
        className="grid gap-4 rounded-2xl border border-border bg-surface p-6 shadow-card"
      >
        <h1 className="text-lg font-semibold">{t("title")}</h1>

        <div className="space-y-2">
          <span className="text-sm">{t("logo")}</span>
          <div className="flex items-center gap-4">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logoUrl}
                alt=""
                className="h-14 w-14 shrink-0 rounded-[11px] border border-border object-contain"
              />
            ) : (
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[11px] bg-gradient-to-br from-primary to-accent text-base font-extrabold text-white">
                AI
              </div>
            )}
            <input
              id="logo"
              name="logo"
              type="file"
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              className="text-[13.5px] text-ink"
            />
          </div>
          <p className="text-xs font-semibold text-ink-sub">{t("logoHint")}</p>
        </div>

        <div className="flex items-center justify-between gap-4">
          <label htmlFor="primaryColor" className="text-sm">
            {t("primaryColor")}
          </label>
          <input
            id="primaryColor"
            name="primaryColor"
            type="color"
            defaultValue={primaryColor}
            className="h-9 w-16 cursor-pointer rounded-[8px] border border-border bg-surface-alt"
          />
        </div>

        <div className="flex items-center justify-between gap-4">
          <label htmlFor="accentColor" className="text-sm">
            {t("accentColor")}
          </label>
          <input
            id="accentColor"
            name="accentColor"
            type="color"
            defaultValue={accentColor}
            className="h-9 w-16 cursor-pointer rounded-[8px] border border-border bg-surface-alt"
          />
        </div>

        {state?.error && <p className="text-sm text-danger">{state.error}</p>}
        {state?.success && <p className="text-sm text-success">{t("success")}</p>}

        <SubmitButton>{tCommon("saveChanges")}</SubmitButton>
      </form>

      <form action={resetFormAction} className="flex items-center gap-3">
        <SubmitButton className="text-xs font-semibold text-ink-sub hover:underline">
          {t("reset")}
        </SubmitButton>
        {resetState?.error && (
          <span className="text-xs text-danger">{resetState.error}</span>
        )}
        {resetState?.success && (
          <span className="text-xs text-success">{t("success")}</span>
        )}
      </form>
    </div>
  );
}
