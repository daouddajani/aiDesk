"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { updateCompanyTheme, resetCompanyTheme } from "./actions";
import { SubmitButton } from "@/components/SubmitButton";
import {
  DEFAULT_THEME_COLORS,
  DEFAULT_CARD_COLORS,
  CARD_COLOR_KEYS,
  type CompanyThemeConfig,
} from "@/lib/companyTheme";

function ColorField({
  id,
  name,
  label,
  defaultValue,
}: {
  id: string;
  name: string;
  label: string;
  defaultValue: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <label htmlFor={id} className="text-sm">
        {label}
      </label>
      <input
        id={id}
        name={name}
        type="color"
        defaultValue={defaultValue}
        className="h-9 w-16 cursor-pointer rounded-[8px] border border-border bg-surface-alt"
      />
    </div>
  );
}

export function ThemingForm({
  logoUrl,
  themeConfig,
}: {
  logoUrl: string | null;
  themeConfig: CompanyThemeConfig;
}) {
  const t = useTranslations("settings.theming");
  const tHome = useTranslations("home");
  const tCommon = useTranslations("common");
  const [state, formAction] = useActionState(updateCompanyTheme, undefined);
  const [resetState, resetFormAction] = useActionState(
    resetCompanyTheme,
    undefined,
  );

  const primaryColor = themeConfig.primaryColor ?? DEFAULT_THEME_COLORS.primaryColor;
  const accentColor = themeConfig.accentColor ?? DEFAULT_THEME_COLORS.accentColor;
  const linkHoverColor =
    themeConfig.linkHoverColor ?? DEFAULT_THEME_COLORS.linkHoverColor;

  const cardLabels: Record<(typeof CARD_COLOR_KEYS)[number], string> = {
    total: tHome("kpiTotal"),
    open: tHome("kpiOpen"),
    new: tHome("kpiNew"),
    pending: tHome("kpiPending"),
    onProcess: tHome("kpiOnProcess"),
    closed: tHome("kpiClosed"),
  };

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

        <ColorField
          id="primaryColor"
          name="primaryColor"
          label={t("primaryColor")}
          defaultValue={primaryColor}
        />
        <ColorField
          id="accentColor"
          name="accentColor"
          label={t("accentColor")}
          defaultValue={accentColor}
        />
        <ColorField
          id="linkHoverColor"
          name="linkHoverColor"
          label={t("linkHoverColor")}
          defaultValue={linkHoverColor}
        />

        <div className="mt-2 border-t border-border pt-4">
          <h2 className="text-sm font-semibold">{t("cardColorsTitle")}</h2>
          <p className="mt-1 text-xs font-semibold text-ink-sub">
            {t("cardColorsHint")}
          </p>
          <div className="mt-3 grid gap-4">
            {CARD_COLOR_KEYS.map((key) => (
              <ColorField
                key={key}
                id={`cardColor_${key}`}
                name={`cardColor_${key}`}
                label={cardLabels[key]}
                defaultValue={themeConfig.cardColors?.[key] ?? DEFAULT_CARD_COLORS[key]}
              />
            ))}
          </div>
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
