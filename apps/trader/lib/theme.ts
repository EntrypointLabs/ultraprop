"use client";

import * as React from "react";
import {
  isTheme,
  type ResolvedTheme,
  type Theme,
  THEME_COOKIE,
} from "@/lib/theme-shared";

export {
  isTheme,
  THEME_COOKIE,
  type ResolvedTheme,
  type Theme,
} from "@/lib/theme-shared";

function systemPrefersDark(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches
  );
}

function resolve(theme: Theme): ResolvedTheme {
  if (theme === "system") return systemPrefersDark() ? "dark" : "light";
  return theme;
}

function writeCookie(theme: Theme) {
  // biome-ignore lint/suspicious/noDocumentCookie: the server must read this preference, so it has to be a real cookie, not the CookieStore async API.
  document.cookie = `${THEME_COOKIE}=${theme}; path=/; max-age=31536000; samesite=lax`;
}

function applyResolved(resolved: ResolvedTheme) {
  const root = document.documentElement;
  root.classList.toggle("dark", resolved === "dark");
  root.style.colorScheme = resolved;
}

interface ThemeContextValue {
  theme: Theme;
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = React.createContext<ThemeContextValue | null>(null);

export function ThemeProvider({
  children,
  initialTheme = "system",
}: {
  children: React.ReactNode;
  initialTheme?: Theme;
}) {
  const [theme, setThemeState] = React.useState<Theme>(initialTheme);
  const [resolvedTheme, setResolvedTheme] = React.useState<ResolvedTheme>(() =>
    initialTheme === "dark" ? "dark" : "light",
  );

  React.useEffect(() => {
    setResolvedTheme(resolve(theme));
  }, [theme]);

  React.useEffect(() => {
    applyResolved(resolvedTheme);
  }, [resolvedTheme]);

  React.useEffect(() => {
    if (theme !== "system") return;
    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => setResolvedTheme(resolve("system"));
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [theme]);

  React.useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === THEME_COOKIE && isTheme(e.newValue)) {
        setThemeState(e.newValue);
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const setTheme = React.useCallback((next: Theme) => {
    writeCookie(next);
    try {
      localStorage.setItem(THEME_COOKIE, next);
    } catch {}
    const nextResolved = resolve(next);
    applyResolved(nextResolved);
    setThemeState(next);
    setResolvedTheme(nextResolved);
  }, []);

  const value = React.useMemo<ThemeContextValue>(
    () => ({ theme, resolvedTheme, setTheme }),
    [theme, resolvedTheme, setTheme],
  );

  return React.createElement(ThemeContext.Provider, { value }, children);
}

export function useTheme(): ThemeContextValue {
  const ctx = React.useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
