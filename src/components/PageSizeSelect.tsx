"use client";

import { useRouter } from "next/navigation";

// `href` per option is precomputed server-side and passed in as plain data —
// a function (e.g. a buildHref callback) can't cross the server/client
// component boundary as a prop, only serializable values can.
export function PageSizeSelect({
  pageSize,
  label,
  options,
}: {
  pageSize: number;
  label: string;
  options: { size: number; href: string }[];
}) {
  const router = useRouter();

  return (
    <label className="flex items-center gap-2 text-ink-sub">
      {label}
      <select
        value={pageSize}
        onChange={(e) => {
          const size = Number(e.target.value);
          const match = options.find((o) => o.size === size);
          if (match) router.push(match.href);
        }}
        className="rounded-[10px] border border-border bg-surface-alt px-2.5 py-1.5 text-sm text-ink"
      >
        {options.map((o) => (
          <option key={o.size} value={o.size}>
            {o.size}
          </option>
        ))}
      </select>
    </label>
  );
}
