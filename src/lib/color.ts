const HEX_RE = /^#[0-9a-fA-F]{6}$/;

export function isValidHexColor(value: string): boolean {
  return HEX_RE.test(value);
}

function hexToRgb(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function mix(hex: string, withHex: string, weight: number) {
  const a = hexToRgb(hex);
  const b = hexToRgb(withHex);
  const r = Math.round(a.r * (1 - weight) + b.r * weight);
  const g = Math.round(a.g * (1 - weight) + b.g * weight);
  const bl = Math.round(a.b * (1 - weight) + b.b * weight);
  return `#${[r, g, bl].map((c) => c.toString(16).padStart(2, "0")).join("")}`;
}

// Derives a readable "soft" tint for active-nav/badge backgrounds: a pale
// mix toward white in light mode, a muted mix toward the dark surface color
// in dark mode (a flat white-mix would look wrong on a dark background).
export function deriveSoftVariant(hex: string, isDark: boolean): string {
  return isDark ? mix(hex, "#161c2e", 0.72) : mix(hex, "#ffffff", 0.88);
}
