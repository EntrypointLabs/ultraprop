"use client";

import { Eye, EyeOff } from "lucide-react";
import * as React from "react";
import { cn } from "@/lib/utils";

interface AuthFieldProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange"> {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  /** Show an eye toggle for password fields. */
  reveal?: boolean;
}

export function AuthField({
  id,
  label,
  value,
  onChange,
  reveal,
  type = "text",
  className,
  ...props
}: AuthFieldProps) {
  const [show, setShow] = React.useState(false);
  const inputType = reveal ? (show ? "text" : "password") : type;

  return (
    <div className="relative">
      <input
        id={id}
        type={inputType}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder=" "
        className={cn(
          "peer h-16 w-full rounded-[var(--radius-lg)] border border-border bg-surface px-4 pt-5 text-base text-text outline-none transition-colors",
          "focus:border-brand focus:ring-2 focus:ring-brand/30",
          reveal && "pr-12",
          className,
        )}
        {...props}
      />
      <label
        htmlFor={id}
        className={cn(
          "pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-base text-text-faint transition-all duration-150",
          "peer-focus:top-3 peer-focus:translate-y-0 peer-focus:text-xs peer-focus:text-text-muted",
          "peer-[:not(:placeholder-shown)]:top-3 peer-[:not(:placeholder-shown)]:translate-y-0 peer-[:not(:placeholder-shown)]:text-xs peer-[:not(:placeholder-shown)]:text-text-muted",
        )}
      >
        {label}
      </label>
      {reveal && (
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          aria-label={show ? "Hide password" : "Show password"}
          aria-pressed={show}
          className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-text-muted transition-colors hover:text-text"
        >
          {show ? (
            <EyeOff className="h-4 w-4" aria-hidden />
          ) : (
            <Eye className="h-4 w-4" aria-hidden />
          )}
        </button>
      )}
    </div>
  );
}
