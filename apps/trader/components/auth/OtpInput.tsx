"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface OtpInputProps {
  value: string;
  onChange: (value: string) => void;
  length?: number;
  autoFocus?: boolean;
  /** Marks every box invalid and nudges the row. */
  error?: boolean;
}

export function OtpInput({
  value,
  onChange,
  length = 4,
  autoFocus,
  error,
}: OtpInputProps) {
  const refs = React.useRef<(HTMLInputElement | null)[]>([]);
  const digits = Array.from({ length }, (_, i) => value[i] ?? "");

  React.useEffect(() => {
    if (autoFocus) refs.current[0]?.focus();
  }, [autoFocus]);

  function handleChange(index: number, raw: string) {
    const cleaned = raw.replace(/\D/g, "");
    if (!cleaned) {
      onChange((value.slice(0, index) + value.slice(index + 1)).slice(0, length));
      return;
    }
    // Paste or fast typing: spread across the remaining boxes.
    const next = (value.slice(0, index) + cleaned).slice(0, length);
    onChange(next);
    const focusAt = Math.min(index + cleaned.length, length - 1);
    refs.current[focusAt]?.focus();
  }

  function handleKeyDown(index: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !digits[index] && index > 0) {
      refs.current[index - 1]?.focus();
    } else if (e.key === "ArrowLeft" && index > 0) {
      e.preventDefault();
      refs.current[index - 1]?.focus();
    } else if (e.key === "ArrowRight" && index < length - 1) {
      e.preventDefault();
      refs.current[index + 1]?.focus();
    }
  }

  return (
    <div className={cn("flex gap-3", error && "auth-shake")}>
      {digits.map((digit, i) => (
        <input
          // eslint-disable-next-line react/no-array-index-key
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          type="text"
          inputMode="numeric"
          autoComplete={i === 0 ? "one-time-code" : "off"}
          maxLength={1}
          value={digit}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onFocus={(e) => e.target.select()}
          aria-label={`Verification digit ${i + 1}`}
          aria-invalid={error ? true : undefined}
          className={cn(
            "tabular h-16 min-w-0 flex-1 rounded-[var(--radius-lg)] border bg-surface text-center text-2xl font-semibold text-text outline-none transition-colors",
            error
              ? "border-down focus:border-down focus:ring-2 focus:ring-down/30"
              : cn(
                  "focus:border-brand focus:ring-2 focus:ring-brand/30",
                  digit ? "border-border-soft" : "border-border",
                ),
          )}
        />
      ))}
    </div>
  );
}
