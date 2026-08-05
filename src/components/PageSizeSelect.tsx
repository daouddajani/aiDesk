"use client";

import { useRouter } from "next/navigation";
import { PAGE_SIZES } from "@/lib/pagination";

export function PageSizeSelect({
  pageSize,
  label,
  buildHref,
}: {
  pageSize: number;
  label: string;
  buildHref: (size: number) => string;
}) {
  const router = useRouter();

  return (
    <label className="flex items-center gap-2 text-ink-sub">
      {label}
      <select
        value={pageSize}
        onChange={(e) => router.push(buildHref(Number(e.target.value)))}
        className="rounded-[10px] border border-border bg-surface-alt px-2.5 py-1.5 text-sm text-ink"
      >
        {PAGE_SIZES.map((size) => (
          <option key={size} value={size}>
            {size}
          </option>
        ))}
      </select>
    </label>
  );
}
