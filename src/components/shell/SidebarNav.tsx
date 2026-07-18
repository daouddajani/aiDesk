"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

export type ShellNavItem = {
  href: string;
  label: string;
  icon: ReactNode;
  badge?: string | number;
};

export function SidebarNav({ items }: { items: ShellNavItem[] }) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 py-2">
      {items.map((item) => {
        const active = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center gap-3 rounded-[10px] px-3.5 py-2.5 text-sm font-semibold transition-colors ${
              active
                ? "bg-primary-soft text-primary"
                : "text-ink-sub hover:bg-surface-alt"
            }`}
          >
            <span className="flex shrink-0 items-center justify-center">
              {item.icon}
            </span>
            <span>{item.label}</span>
            {item.badge && (
              <span className="ms-auto rounded-full bg-danger-soft px-2 py-0.5 text-[11px] font-bold text-danger">
                {item.badge}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
