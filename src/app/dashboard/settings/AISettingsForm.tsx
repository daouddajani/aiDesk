"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { updateAISettings } from "./actions";
import { SubmitButton } from "@/components/SubmitButton";
import type { AIProviderName } from "@/lib/ai";

type Config = {
  enabled: boolean;
  provider: AIProviderName;
};

export function AISettingsForm({
  config,
  hasProviderKey,
  hasEmbeddingsKey,
  monthTokens,
}: {
  config: Config;
  hasProviderKey: boolean;
  hasEmbeddingsKey: boolean;
  monthTokens: number;
}) {
  const t = useTranslations("settings.ai");
  const tCommon = useTranslations("common");
  const [state, formAction] = useActionState(updateAISettings, undefined);
  const [provider, setProvider] = useState<AIProviderName>(config.provider);

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
          defaultChecked={config.enabled}
          className="h-4 w-4 rounded border-border"
        />
        {t("enabledLabel")}
      </label>

      <div className="space-y-1">
        <label htmlFor="provider" className="text-sm">
          {t("providerLabel")}
        </label>
        <select
          id="provider"
          name="provider"
          value={provider}
          onChange={(e) => setProvider(e.target.value as AIProviderName)}
          className="w-full rounded-[10px] border border-border bg-surface-alt px-3.5 py-2.5 text-[13.5px] text-ink"
        >
          <option value="openai">{t("providerOpenai")}</option>
          <option value="anthropic">{t("providerAnthropic")}</option>
          <option value="gemini">{t("providerGemini")}</option>
        </select>
      </div>

      <div className="space-y-1">
        <label htmlFor="apiKey" className="text-sm">
          {t("apiKeyLabel")}
        </label>
        <input
          id="apiKey"
          name="apiKey"
          type="password"
          autoComplete="off"
          placeholder={hasProviderKey ? t("apiKeyConfiguredPlaceholder") : "sk-..."}
          className="w-full rounded-[10px] border border-border bg-surface-alt px-3.5 py-2.5 text-[13.5px] text-ink"
        />
        {hasProviderKey && (
          <p className="text-xs font-semibold text-ink-sub">
            {t("apiKeyConfiguredHint")}
          </p>
        )}
      </div>

      {provider !== "openai" && (
        <div className="space-y-1">
          <label htmlFor="embeddingsApiKey" className="text-sm">
            {t("embeddingsKeyLabel")}
          </label>
          <input
            id="embeddingsApiKey"
            name="embeddingsApiKey"
            type="password"
            autoComplete="off"
            placeholder={
              hasEmbeddingsKey ? t("apiKeyConfiguredPlaceholder") : "sk-..."
            }
            className="w-full rounded-[10px] border border-border bg-surface-alt px-3.5 py-2.5 text-[13.5px] text-ink"
          />
          <p className="text-xs font-semibold text-ink-sub">
            {hasEmbeddingsKey
              ? t("embeddingsKeyConfiguredHint")
              : t("embeddingsKeyHint")}
          </p>
        </div>
      )}

      <div className="rounded-xl bg-surface-alt p-3.5 text-[13px]">
        <span className="font-semibold text-ink-sub">{t("usageThisMonth")}</span>{" "}
        <span className="font-bold text-ink">
          {monthTokens.toLocaleString()}
        </span>
      </div>

      {state?.error && <p className="text-sm text-danger">{state.error}</p>}
      {state?.success && <p className="text-sm text-success">{t("success")}</p>}

      <SubmitButton>{tCommon("saveChanges")}</SubmitButton>
    </form>
  );
}
