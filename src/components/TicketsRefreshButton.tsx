"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Spinner } from "./Spinner";

export function TicketsRefreshButton({ label }: { label: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={isPending}
      aria-busy={isPending}
      onClick={() => startTransition(() => router.refresh())}
      className="flex items-center gap-2 rounded-[10px] border border-border bg-surface px-3.5 py-2 text-sm font-semibold text-ink transition-colors hover:bg-surface-alt disabled:opacity-50"
    >
      {isPending ? (
        <Spinner className="h-4 w-4" />
      ) : (
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          aria-hidden="true"
        >
          <path d="M21 12a9 9 0 1 1-2.64-6.36"></path>
          <path d="M21 3v6h-6"></path>
        </svg>
      )}
      {label}
    </button>
  );
}
