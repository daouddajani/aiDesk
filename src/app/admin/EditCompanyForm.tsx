"use client";

import { useActionState, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { updateCompany } from "./actions";
import { SubmitButton } from "@/components/SubmitButton";
import { ME_TIMEZONES } from "@/lib/timezones";

type Company = {
  id: string;
  name: string;
  timezone: string;
  helpdesk_email: string | null;
};

export function EditCompanyForm({ company }: { company: Company }) {
  const t = useTranslations();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [state, formAction] = useActionState(updateCompany, undefined);

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
        className="rounded-[10px] border border-border bg-surface px-2.5 py-1 text-xs font-semibold text-ink hover:bg-surface-alt"
      >
        {t("common.edit")}
      </button>
      <dialog
        ref={dialogRef}
        className="w-full max-w-md rounded-2xl border border-border bg-surface p-6 text-ink backdrop:bg-black/40"
      >
        <form action={formAction} className="grid gap-4">
          <h2 className="font-semibold">{t("admin.editCompany.title")}</h2>
          <input type="hidden" name="companyId" value={company.id} />

          <div className="space-y-1">
            <label htmlFor={`name-${company.id}`} className="text-sm">
              {t("admin.editCompany.name")}
            </label>
            <input
              id={`name-${company.id}`}
              name="name"
              required
              defaultValue={company.name}
              className="w-full rounded-[10px] border border-border bg-surface-alt px-3.5 py-2.5 text-[13.5px] text-ink"
            />
          </div>

          <div className="space-y-1">
            <label htmlFor={`timezone-${company.id}`} className="text-sm">
              {t("admin.editCompany.timezone")}
            </label>
            <select
              id={`timezone-${company.id}`}
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
            <label htmlFor={`helpdeskEmail-${company.id}`} className="text-sm">
              {t("admin.editCompany.helpdeskEmail")}
            </label>
            <input
              id={`helpdeskEmail-${company.id}`}
              name="helpdeskEmail"
              type="email"
              defaultValue={company.helpdesk_email ?? ""}
              className="w-full rounded-[10px] border border-border bg-surface-alt px-3.5 py-2.5 text-[13.5px] text-ink"
            />
          </div>

          {state?.error && (
            <p className="text-sm text-danger">{state.error}</p>
          )}

          <div className="flex items-center justify-between gap-2 pt-2">
            <button
              type="button"
              onClick={() => dialogRef.current?.close()}
              className="text-sm text-ink-sub hover:underline"
            >
              {t("common.cancel")}
            </button>
            <div className="w-32">
              <SubmitButton>{t("common.saveChanges")}</SubmitButton>
            </div>
          </div>
        </form>
      </dialog>
    </>
  );
}
