"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function TicketsAutoRefresh({
  enabled,
  intervalMinutes,
}: {
  enabled: boolean;
  intervalMinutes: number;
}) {
  const router = useRouter();

  useEffect(() => {
    if (!enabled) return;
    const id = setInterval(() => router.refresh(), intervalMinutes * 60 * 1000);
    return () => clearInterval(id);
  }, [enabled, intervalMinutes, router]);

  return null;
}
