"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

const SidebarCollapseContext = createContext<{
  collapsed: boolean;
  toggle: () => void;
} | null>(null);

export function SidebarCollapseProvider({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);

  const toggle = () => setCollapsed((prev) => !prev);

  return (
    <SidebarCollapseContext.Provider value={{ collapsed, toggle }}>
      {children}
    </SidebarCollapseContext.Provider>
  );
}

function useSidebarCollapse() {
  const ctx = useContext(SidebarCollapseContext);
  if (!ctx) {
    throw new Error(
      "useSidebarCollapse must be used within a SidebarCollapseProvider",
    );
  }
  return ctx;
}

export function CollapsibleSidebar({ children }: { children: ReactNode }) {
  const { collapsed } = useSidebarCollapse();

  return (
    <aside
      className={`sticky top-0 hidden h-screen shrink-0 flex-col bg-surface transition-[width] duration-200 md:flex ${
        collapsed
          ? "md:w-0 md:overflow-hidden md:border-e-0"
          : "md:w-64 md:border-e md:border-border"
      }`}
    >
      {children}
    </aside>
  );
}

export function SidebarToggleButton() {
  const { collapsed, toggle } = useSidebarCollapse();

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="Toggle sidebar"
      title="Toggle sidebar"
      className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border text-ink-sub hover:bg-surface-alt md:flex"
    >
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <rect x="3" y="3" width="18" height="18" rx="2"></rect>
        <line x1="9" y1="3" x2="9" y2="21"></line>
      </svg>
      <span className="sr-only">
        {collapsed ? "Show menu" : "Hide menu"}
      </span>
    </button>
  );
}
