"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { reassignTicket } from "../actions";
import { SubmitButton } from "@/components/SubmitButton";

type AgentOption = {
  id: string;
  name: string;
};

export function ReassignTicketForm({
  ticketId,
  currentAgentId,
  agentOptions,
}: {
  ticketId: string;
  currentAgentId: string | null;
  agentOptions: AgentOption[];
}) {
  const t = useTranslations("tickets.reassign");
  const [state, formAction] = useActionState(reassignTicket, undefined);

  return (
    <form action={formAction} className="flex items-center gap-2">
      <input type="hidden" name="ticketId" value={ticketId} />
      <select
        name="agentId"
        defaultValue={currentAgentId ?? ""}
        className="min-w-0 flex-1 rounded-[10px] border border-border bg-surface-alt px-2.5 py-1.5 text-xs text-ink"
      >
        <option value="" disabled>
          {t("placeholder")}
        </option>
        {agentOptions.map((agent) => (
          <option key={agent.id} value={agent.id}>
            {agent.name}
          </option>
        ))}
      </select>
      <SubmitButton className="shrink-0 rounded-[10px] border border-border bg-surface px-3 py-1.5 text-xs font-bold text-ink transition-colors hover:bg-surface-alt disabled:opacity-50">
        {t("submit")}
      </SubmitButton>
      {state?.error && (
        <span className="text-xs text-danger">{state.error}</span>
      )}
    </form>
  );
}
