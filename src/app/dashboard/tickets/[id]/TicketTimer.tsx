"use client";

import { useActionState, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { startTimer, stopTimer } from "../actions";
import { formatDuration } from "@/lib/duration";
import { SubmitButton } from "@/components/SubmitButton";

export function TicketTimer({
  ticketId,
  isRunningForMe,
  runningStartedAt,
  staticTotalSeconds,
  canStart,
}: {
  ticketId: string;
  isRunningForMe: boolean;
  runningStartedAt: string | null;
  staticTotalSeconds: number;
  // Starting a new session is blocked on closed tickets, but stopping an
  // already-running one never is — otherwise a timer left running when a
  // ticket gets closed would have no way to stop.
  canStart: boolean;
}) {
  const t = useTranslations("tickets.timer");
  const [startState, startAction] = useActionState(startTimer, undefined);
  const [stopState, stopAction] = useActionState(stopTimer, undefined);
  const [liveSeconds, setLiveSeconds] = useState(() =>
    isRunningForMe && runningStartedAt
      ? Math.floor((Date.now() - new Date(runningStartedAt).getTime()) / 1000)
      : 0,
  );

  useEffect(() => {
    if (!isRunningForMe || !runningStartedAt) return;
    const startedMs = new Date(runningStartedAt).getTime();
    const tick = () =>
      setLiveSeconds(Math.floor((Date.now() - startedMs) / 1000));
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [isRunningForMe, runningStartedAt]);

  const totalSeconds = staticTotalSeconds + (isRunningForMe ? liveSeconds : 0);
  const error = startState?.error || stopState?.error;

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs font-semibold text-ink-sub">
        {t("tracked")} <span className="text-ink">{formatDuration(totalSeconds)}</span>
      </span>
      {(isRunningForMe || canStart) && (
        <form action={isRunningForMe ? stopAction : startAction}>
          <input type="hidden" name="ticketId" value={ticketId} />
          <SubmitButton
            className={`rounded-[10px] border px-3 py-1.5 text-[13px] font-bold transition-colors ${
              isRunningForMe
                ? "border-danger bg-danger-soft text-danger hover:opacity-90"
                : "border-border bg-surface text-ink hover:bg-surface-alt"
            } disabled:opacity-50`}
          >
            {isRunningForMe ? t("stop") : t("start")}
          </SubmitButton>
        </form>
      )}
      {error && <span className="text-xs text-danger">{error}</span>}
    </div>
  );
}
