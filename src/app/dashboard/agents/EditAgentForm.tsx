"use client";

import { useActionState, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { updateAgent } from "./actions";
import { SubmitButton } from "@/components/SubmitButton";

type Profile = {
  id: string;
  full_name: string | null;
  skills: string[] | null;
  disabled: boolean;
};

export function EditAgentForm({ profile }: { profile: Profile }) {
  const t = useTranslations();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [state, formAction] = useActionState(updateAgent, undefined);

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
          <h2 className="font-semibold">{t("agents.editForm.title")}</h2>
          <input type="hidden" name="profileId" value={profile.id} />

          <div className="space-y-1">
            <label htmlFor={`fullName-${profile.id}`} className="text-sm">
              {t("agents.editForm.fullNameLabel")}
            </label>
            <input
              id={`fullName-${profile.id}`}
              name="fullName"
              defaultValue={profile.full_name ?? ""}
              className="w-full rounded-[10px] border border-border bg-surface-alt px-3.5 py-2.5 text-[13.5px] text-ink"
            />
          </div>

          <div className="space-y-1">
            <label htmlFor={`skills-${profile.id}`} className="text-sm">
              {t("agents.editForm.skillsLabel")}
            </label>
            <input
              id={`skills-${profile.id}`}
              name="skills"
              defaultValue={(profile.skills ?? []).join(", ")}
              placeholder={t("agents.editForm.skillsPlaceholder")}
              className="w-full rounded-[10px] border border-border bg-surface-alt px-3.5 py-2.5 text-[13.5px] text-ink"
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              id={`disabled-${profile.id}`}
              name="disabled"
              type="checkbox"
              defaultChecked={profile.disabled}
              className="h-4 w-4 rounded border border-border"
            />
            <label htmlFor={`disabled-${profile.id}`} className="text-sm">
              {t("agents.editForm.disabledLabel")}
            </label>
          </div>
          <p className="text-xs text-ink-sub">
            {t("agents.editForm.disabledHint")}
          </p>

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
