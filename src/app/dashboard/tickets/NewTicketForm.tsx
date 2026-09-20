"use client";

import { useActionState, useRef } from "react";
import { useTranslations } from "next-intl";
import { createTicket } from "./actions";
import { SubmitButton } from "@/components/SubmitButton";

type AgentOption = {
  id: string;
  name: string;
};

export function NewTicketForm({
  currentUserId,
  agentOptions,
}: {
  currentUserId: string;
  agentOptions: AgentOption[];
}) {
  const t = useTranslations("tickets.newTicket");
  const [state, formAction] = useActionState(createTicket, undefined);
  const dialogRef = useRef<HTMLDialogElement>(null);

  return (
    <>
      <button
        type="button"
        onClick={() => dialogRef.current?.showModal()}
        className="rounded-[10px] bg-primary px-4 py-2 text-[13.5px] font-bold text-white transition-opacity hover:opacity-90"
      >
        {t("trigger")}
      </button>
      <dialog
        ref={dialogRef}
        className="w-full max-w-md rounded-2xl border border-border bg-surface p-6 text-ink backdrop:bg-black/40"
      >
        <form action={formAction} className="grid gap-4">
          <h2 className="font-extrabold text-ink">{t("title")}</h2>

          <div className="space-y-1">
            <label htmlFor="subject" className="text-[12.5px] font-bold text-ink-sub">
              {t("subjectLabel")}
            </label>
            <input
              id="subject"
              name="subject"
              type="text"
              required
              placeholder={t("subjectPlaceholder")}
              className="w-full rounded-[10px] border border-border bg-surface-alt px-3.5 py-2.5 text-[13.5px] text-ink placeholder:text-ink-sub"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label htmlFor="senderName" className="text-[12.5px] font-bold text-ink-sub">
                {t("senderNameLabel")}
              </label>
              <input
                id="senderName"
                name="senderName"
                type="text"
                placeholder={t("senderNamePlaceholder")}
                className="w-full rounded-[10px] border border-border bg-surface-alt px-3.5 py-2.5 text-[13.5px] text-ink placeholder:text-ink-sub"
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="senderEmail" className="text-[12.5px] font-bold text-ink-sub">
                {t("senderEmailLabel")}
              </label>
              <input
                id="senderEmail"
                name="senderEmail"
                type="email"
                required
                placeholder={t("senderEmailPlaceholder")}
                className="w-full rounded-[10px] border border-border bg-surface-alt px-3.5 py-2.5 text-[13.5px] text-ink placeholder:text-ink-sub"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label htmlFor="description" className="text-[12.5px] font-bold text-ink-sub">
              {t("descriptionLabel")}
            </label>
            <textarea
              id="description"
              name="description"
              required
              rows={4}
              placeholder={t("descriptionPlaceholder")}
              className="w-full resize-y rounded-[10px] border border-border bg-surface-alt px-3.5 py-2.5 text-[13.5px] text-ink placeholder:text-ink-sub"
              data-gramm="false"
              data-gramm_editor="false"
              data-enable-grammarly="false"
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="agentId" className="text-[12.5px] font-bold text-ink-sub">
              {t("assigneeLabel")}
            </label>
            <select
              id="agentId"
              name="agentId"
              defaultValue=""
              className="w-full rounded-[10px] border border-border bg-surface-alt px-3.5 py-2.5 text-[13.5px] text-ink"
            >
              <option value="">{t("unassignedOption")}</option>
              <option value={currentUserId}>{t("assignToMe")}</option>
              {agentOptions.map((agent) => (
                <option key={agent.id} value={agent.id}>
                  {agent.name}
                </option>
              ))}
            </select>
          </div>

          {state?.error && (
            <p className="text-sm text-danger">{state.error}</p>
          )}

          <div className="flex items-center justify-between gap-2 pt-2">
            <button
              type="button"
              onClick={() => dialogRef.current?.close()}
              className="text-sm font-semibold text-ink-sub hover:underline"
            >
              {t("cancel")}
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
