"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { inviteCompanyAdmin } from "./actions";

export function InviteAdminForm({ companyId }: { companyId: string }) {
  const t = useTranslations("admin.inviteAdminForm");
  const [state, formAction] = useActionState(inviteCompanyAdmin, undefined);

  if (state?.success) {
    return <span className="text-sm text-success">{t("success")}</span>;
  }

  return (
    <form action={formAction} className="flex items-center gap-2">
      <input type="hidden" name="companyId" value={companyId} />
      <input
        name="adminEmail"
        type="email"
        placeholder={t("placeholder")}
        required
        className="w-48 rounded-[10px] border border-border bg-surface-alt px-2.5 py-1.5 text-[13.5px] text-ink"
      />
      <button
        type="submit"
        className="rounded-[10px] border border-border bg-surface px-2.5 py-1 text-sm font-semibold text-ink hover:bg-surface-alt"
      >
        {t("submit")}
      </button>
      {state?.error && (
        <span className="text-sm text-danger">{state.error}</span>
      )}
    </form>
  );
}
