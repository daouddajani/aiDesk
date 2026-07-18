"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";

type Toast = {
  id: string;
  ticketId: string;
  subject: string;
  senderLabel: string;
};

const AUTO_DISMISS_MS = 8000;

export function TicketNotifications({ companyId }: { companyId: string }) {
  const t = useTranslations("notifications");
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    const supabase = createClient();
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;

    // Realtime authorizes postgres_changes using the session's JWT via
    // realtime.setAuth(), which the client wires up asynchronously on an
    // auth-state-change listener. Subscribing before that resolves joins
    // the channel unauthenticated, so RLS silently delivers nothing —
    // awaiting the session first guarantees setAuth() has already run.
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (cancelled || !session) return;

      channel = supabase
        .channel(`tickets-notify-${companyId}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "tickets",
            filter: `company_id=eq.${companyId}`,
          },
          (payload) => {
            const ticket = payload.new as {
              id: string;
              subject: string;
              sender_name: string | null;
              sender_email: string;
            };
            setToasts((prev) => [
              ...prev,
              {
                id: crypto.randomUUID(),
                ticketId: ticket.id,
                subject: ticket.subject,
                senderLabel: ticket.sender_name || ticket.sender_email,
              },
            ]);
          },
        )
        .subscribe();
    });

    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, [companyId]);

  const dismiss = (id: string) =>
    setToasts((prev) => prev.filter((toast) => toast.id !== id));

  if (toasts.length === 0) return null;

  return (
    <div className="fixed inset-x-4 top-4 z-50 flex flex-col items-stretch gap-2 md:inset-x-auto md:end-6 md:top-20 md:w-80">
      {toasts.map((toast) => (
        <NotificationToast
          key={toast.id}
          toast={toast}
          onDismiss={() => dismiss(toast.id)}
          newTicketLabel={t("newTicket")}
          fromLabel={t("from")}
          viewLabel={t("view")}
        />
      ))}
    </div>
  );
}

function NotificationToast({
  toast,
  onDismiss,
  newTicketLabel,
  fromLabel,
  viewLabel,
}: {
  toast: Toast;
  onDismiss: () => void;
  newTicketLabel: string;
  fromLabel: string;
  viewLabel: string;
}) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex items-start gap-3 rounded-2xl border border-border bg-surface p-3.5 shadow-card">
      <span className="mt-0.5 inline-flex h-2 w-2 shrink-0 rounded-full bg-info" />
      <div className="min-w-0 flex-1">
        <div className="text-[11.5px] font-bold tracking-wide text-info uppercase">
          {newTicketLabel}
        </div>
        <div className="mt-0.5 truncate text-[13.5px] font-semibold text-ink">
          {toast.subject}
        </div>
        <div className="truncate text-xs text-ink-sub">
          {fromLabel} {toast.senderLabel}
        </div>
        <Link
          href={`/dashboard/tickets/${toast.ticketId}`}
          onClick={onDismiss}
          className="mt-1.5 inline-block text-xs font-bold text-primary hover:underline"
        >
          {viewLabel}
        </Link>
      </div>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss"
        className="shrink-0 text-ink-sub hover:text-ink"
      >
        ×
      </button>
    </div>
  );
}
