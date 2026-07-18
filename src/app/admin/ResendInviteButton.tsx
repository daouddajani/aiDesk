"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { inviteCompanyAdmin } from "./actions";

export function ResendInviteButton({
  companyId,
  adminEmail,
}: {
  companyId: string;
  adminEmail: string;
}) {
  const t = useTranslations("admin.resendInvite");
  const [state, formAction] = useActionState(inviteCompanyAdmin, undefined);

  if (state?.success) {
    return <span className="text-sm text-success">{t("success")}</span>;
  }

  return (
    <form action={formAction} className="flex items-center gap-2">
      <input type="hidden" name="companyId" value={companyId} />
      <input type="hidden" name="adminEmail" value={adminEmail} />
      <button
        type="submit"
        className="rounded-[10px] border border-border bg-surface px-2.5 py-1 text-xs font-semibold whitespace-nowrap text-ink hover:bg-surface-alt"
      >
        {t("submit")}
      </button>
      {state?.error && (
        <span className="text-sm text-danger">{state.error}</span>
      )}
    </form>
  );
}
