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
