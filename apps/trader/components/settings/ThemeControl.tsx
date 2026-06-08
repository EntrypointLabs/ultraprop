"use client";

import { type Theme, useTheme } from "@/lib/theme";

const OPTIONS: { value: Theme; label: string }[] = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

export function ThemeControl() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm text-text-muted">Appearance</span>
      <div
        role="radiogroup"
        aria-label="Appearance"
        className="inline-flex items-center gap-0.5 rounded-[var(--radius)] border border-border bg-surface p-0.5"
      >
        {OPTIONS.map((opt) => {
          const active = opt.value === theme;
          return (
            // biome-ignore lint/a11y/useSemanticElements: native radios can't carry the segmented-control visual vocabulary; role="radio" is correct ARIA for this single-select.
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => setTheme(opt.value)}
              className={`rounded-sm px-2.5 py-1 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-violet focus-visible:outline-offset-2 ${
                active
                  ? "bg-surface-3 text-text"
                  : "text-text-muted hover:text-text"
              }`}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
