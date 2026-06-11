export type Theme = "system" | "light" | "dark";
export type ResolvedTheme = "light" | "dark";

export const THEME_COOKIE = "up-theme";

const THEME_VALUES: Theme[] = ["system", "light", "dark"];

export function isTheme(value: unknown): value is Theme {
  return typeof value === "string" && THEME_VALUES.includes(value as Theme);
}
