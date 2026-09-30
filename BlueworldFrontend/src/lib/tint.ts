/**
 * Named colours for a country showcase's fallback tint. The `tint` column in
 * the database stays a plain string: it can hold one of these names, or a raw
 * CSS gradient (the four seeded countries), and resolveTint() handles both.
 */
export const TINT_COLORS = {
  green: "linear-gradient(160deg, #0d3b2e 0%, #0b1a2a 100%)",
  orange: "linear-gradient(160deg, #4d2a08 0%, #0b1a2a 100%)",
  blue: "linear-gradient(160deg, #0c2a52 0%, #0b1a2a 100%)",
  red: "linear-gradient(160deg, #4a1016 0%, #0b1a2a 100%)",
  purple: "linear-gradient(160deg, #2e1450 0%, #0b1a2a 100%)",
  teal: "linear-gradient(160deg, #0b3b40 0%, #0b1a2a 100%)",
  navy: "linear-gradient(160deg, #0a1f44 0%, #060d1c 100%)",
  gray: "linear-gradient(160deg, #2a2f38 0%, #0b1a2a 100%)",
} as const;

export type TintColorName = keyof typeof TINT_COLORS;

export const TINT_COLOR_NAMES = Object.keys(TINT_COLORS) as TintColorName[];

/**
 * Known colour name -> its gradient. Anything else (an already-seeded raw
 * gradient string, or a future raw value) passes through unchanged.
 */
export function resolveTint(value: string | null | undefined): string {
  if (!value) return "";
  const key = value.trim().toLowerCase();
  return key in TINT_COLORS ? TINT_COLORS[key as TintColorName] : value;
}