"use client";

import { useActionState, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { createCompany } from "./actions";
import { SubmitButton } from "@/components/SubmitButton";
import { ME_TIMEZONES } from "@/lib/timezones";

export function CreateCompanyForm() {
  const t = useTranslations("admin.createCompany");
  const tCommon = useTranslations("common");
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [state, formAction] = useActionState(createCompany, undefined);

  useEffect(() => {
    if (state?.success) {
      dialogRef.current?.close();
    }
  }, [state]);

  return (
    <>
      <button
        type="button"
        onClick={() => dialogRef.current?.showModal()}
        className="rounded-[10px] bg-primary px-4 py-2.5 text-sm font-bold text-white transition-opacity hover:opacity-90"
      >
        {t("title")}
      </button>
      <dialog
        ref={dialogRef}
        className="w-full max-w-lg rounded-2xl border border-border bg-surface p-6 text-ink backdrop:bg-black/40"
      >
        <form action={formAction} className="grid gap-4">
          <h2 className="font-semibold">{t("title")}</h2>

          <div className="space-y-1">
            <label htmlFor="name" className="text-sm">
              {t("name")}
            </label>
            <input
              id="name"
              name="name"
              required
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
              defaultValue="Asia/Riyadh"
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
            <label htmlFor="helpdeskEmail" className="text-sm">
              {t("helpdeskEmail")}
            </label>
            <input
              id="helpdeskEmail"
              name="helpdeskEmail"
              type="email"
              className="w-full rounded-[10px] border border-border bg-surface-alt px-3.5 py-2.5 text-[13.5px] text-ink"
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="adminEmail" className="text-sm">
              {t("adminEmail")}
            </label>
            <input
              id="adminEmail"
              name="adminEmail"
              type="email"
              required
              className="w-full rounded-[10px] border border-border bg-surface-alt px-3.5 py-2.5 text-[13.5px] text-ink"
            />
          </div>

          {state?.error && <p className="text-sm text-danger">{state.error}</p>}

          <div className="flex items-center justify-between gap-2 pt-2">
            <button
              type="button"
              onClick={() => dialogRef.current?.close()}
              className="text-sm text-ink-sub hover:underline"
            >
              {tCommon("cancel")}
            </button>
            <div className="w-32">
              <SubmitButton>{t("submit")}</SubmitButton>
            </div>
          </div>
        </form>
      </dialog>
    </>
  );
}
