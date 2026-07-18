"use client";

import { useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";

export function MobileNav({
  brandLabel,
  children,
}: {
  brandLabel: string;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  // Close the drawer on navigation. Adjusting state during render (rather
  // than in an effect) is the React-recommended pattern for "reset state
  // when a prop changes" — it re-renders before paint instead of causing a
  // separate cascading effect-driven render.
  const [renderedPathname, setRenderedPathname] = useState(pathname);
  if (pathname !== renderedPathname) {
    setRenderedPathname(pathname);
    setOpen(false);
  }

  return (
    <>
      <div className="sticky top-0 z-20 flex items-center justify-between border-b border-border bg-surface px-4 py-3 md:hidden">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Menu"
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-border text-ink-sub"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <line x1="3" y1="6" x2="21" y2="6"></line>
            <line x1="3" y1="12" x2="21" y2="12"></line>
            <line x1="3" y1="18" x2="21" y2="18"></line>
          </svg>
        </button>
        <span className="text-base font-extrabold text-ink">{brandLabel}</span>
        <div className="w-9" />
      </div>

      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/50 md:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      <aside
        className={`fixed inset-y-0 start-0 z-40 flex w-64 flex-col border-e border-border bg-surface transition-transform duration-200 md:hidden ${
          open ? "translate-x-0" : "-translate-x-full rtl:translate-x-full"
        }`}
      >
        {children}
      </aside>
    </>
  );
}
