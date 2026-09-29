export type CardColorKey =
  | "total"
  | "open"
  | "new"
  | "pending"
  | "onProcess"
  | "closed";

export type CompanyThemeConfig = {
  primaryColor?: string;
  accentColor?: string;
  linkHoverColor?: string;
  cardColors?: Partial<Record<CardColorKey, string>>;
};

export const DEFAULT_THEME_COLORS = {
  primaryColor: "#4338ca",
  accentColor: "#7c6df2",
  linkHoverColor: "#4338ca",
};

// Matches the light-mode --color-kpi-* defaults in globals.css — used as
// the fallback whenever a company's saved theme predates a given card, or
// simply hasn't customized it yet.
export const DEFAULT_CARD_COLORS: Record<CardColorKey, string> = {
  total: "#7c6df2",
  open: "#0d9488",
  new: "#2563eb",
  pending: "#c07800",
  onProcess: "#4338ca",
  closed: "#5c6480",
};

// Maps each card key to the CSS custom property it drives (see globals.css).
export const CARD_COLOR_CSS_VAR: Record<CardColorKey, string> = {
  total: "--color-kpi-total",
  open: "--color-kpi-open",
  new: "--color-kpi-new",
  pending: "--color-kpi-pending",
  onProcess: "--color-kpi-on-process",
  closed: "--color-kpi-closed",
};

export const CARD_COLOR_SOFT_CSS_VAR: Record<CardColorKey, string> = {
  total: "--color-kpi-total-soft",
  open: "--color-kpi-open-soft",
  new: "--color-kpi-new-soft",
  pending: "--color-kpi-pending-soft",
  onProcess: "--color-kpi-on-process-soft",
  closed: "--color-kpi-closed-soft",
};

export const CARD_COLOR_KEYS: CardColorKey[] = [
  "total",
  "open",
  "new",
  "pending",
  "onProcess",
  "closed",
];

export type ResolvedThemeColors = {
  primaryColor: string;
  accentColor: string;
  linkHoverColor: string;
  cardColors: Record<CardColorKey, string>;
};

// Shared by every page that renders AppShell with a company's saved
// theme_config (dashboard layout, profile page): null until a company has
// actually saved both a primary and accent color, since AppShell falls back
// to the CSS defaults itself when no override is passed.
export function resolveThemeColors(
  themeConfig: CompanyThemeConfig | null | undefined,
): ResolvedThemeColors | null {
  if (!themeConfig?.primaryColor || !themeConfig?.accentColor) return null;

  return {
    primaryColor: themeConfig.primaryColor,
    accentColor: themeConfig.accentColor,
    // Falls back to the primary color for themes saved before the
    // link-hover picker existed (theme_config predates that field).
    linkHoverColor: themeConfig.linkHoverColor ?? themeConfig.primaryColor,
    // Same fallback idea, per card, for themes saved before the status
    // card colors existed.
    cardColors: Object.fromEntries(
      CARD_COLOR_KEYS.map((key) => [
        key,
        themeConfig.cardColors?.[key] ?? DEFAULT_CARD_COLORS[key],
      ]),
    ) as Record<CardColorKey, string>,
  };
}

// Ticket status pill colors — driven by the same per-company --color-kpi-*
// variables AppShell injects from theme_config.cardColors, so a status
// badge anywhere in the app (ticket list, ticket detail, performance,
// dashboard recent-tickets table) matches the "Dashboard status cards"
// colors a company customizes in Theming settings.
export const STATUS_BADGE_CLASSES: Record<string, string> = {
  new: "bg-kpi-new-soft text-kpi-new",
  pending: "bg-kpi-pending-soft text-kpi-pending",
  on_process: "bg-kpi-on-process-soft text-kpi-on-process",
  closed: "bg-kpi-closed-soft text-kpi-closed",
};
