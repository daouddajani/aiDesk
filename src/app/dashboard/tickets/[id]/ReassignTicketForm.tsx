"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { reassignTicket } from "../actions";

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
      <button
        type="submit"
        className="shrink-0 rounded-[10px] border border-border bg-surface px-3 py-1.5 text-xs font-bold text-ink transition-colors hover:bg-surface-alt"
      >
        {t("submit")}
      </button>
      {state?.error && (
        <span className="text-xs text-danger">{state.error}</span>
      )}
    </form>
  );
}
