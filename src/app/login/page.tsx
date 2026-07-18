"use client";

import { useActionState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { login } from "./actions";
import { SubmitButton } from "@/components/SubmitButton";

export default function LoginPage() {
  const t = useTranslations("login");
  const [state, formAction] = useActionState(login, undefined);

  return (
    <main className="flex flex-1 items-center justify-center bg-bg p-6">
      <form
        action={formAction}
        className="w-full max-w-sm space-y-5 rounded-2xl border border-border bg-surface p-8 shadow-card"
      >
        <div className="space-y-1 text-center">
          <p className="text-lg font-extrabold tracking-tight text-primary">
            AiDesk
          </p>
          <h1 className="text-base font-semibold text-ink">{t("title")}</h1>
        </div>

        <div className="space-y-1">
          <label htmlFor="email" className="text-sm text-ink">
            {t("email")}
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            className="w-full rounded-[10px] border border-border bg-surface-alt px-3.5 py-2.5 text-[13.5px] text-ink"
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="password" className="text-sm text-ink">
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

        <Link
          href="/forgot-password"
          className="block text-center text-sm text-ink-sub hover:underline"
        >
          {t("forgotPassword")}
        </Link>
      </form>
    </main>
  );
}
