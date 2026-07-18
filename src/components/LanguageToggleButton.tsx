"use client";

import { useLocale } from "next-intl";
import { toggleLocale } from "@/app/actions";

export function LanguageToggleButton() {
  const locale = useLocale();
  const nextLabel = locale === "ar" ? "English" : "العربية";

  return (
    <form action={toggleLocale}>
      <button
        type="submit"
        title="Language"
        className="flex h-9 items-center justify-center rounded-lg border border-border bg-surface px-3 text-xs font-bold text-ink-sub"
      >
        {nextLabel}
      </button>
    </form>
  );
}
