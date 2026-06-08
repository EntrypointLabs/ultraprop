"use client";

import { AtSign } from "lucide-react";
import * as React from "react";
import { cn } from "@/lib/utils";

function GoogleGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" aria-hidden>
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1Z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84Z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38Z"
      />
    </svg>
  );
}

function AppleGlyph() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-[18px] w-[18px]"
      fill="currentColor"
      aria-hidden
    >
      <path d="M16.36 12.78c.02 2.5 2.19 3.33 2.21 3.34-.02.06-.35 1.2-1.15 2.37-.69 1.02-1.41 2.03-2.54 2.05-1.11.02-1.47-.66-2.74-.66-1.27 0-1.66.64-2.71.68-1.09.04-1.92-1.1-2.62-2.12-1.42-2.06-2.51-5.83-1.05-8.37.72-1.27 2.01-2.07 3.41-2.09 1.07-.02 2.08.72 2.74.72.65 0 1.88-.89 3.17-.76.54.02 2.06.22 3.03 1.64-.08.05-1.81 1.06-1.8 3.16M14.28 4.5c.58-.7.97-1.68.86-2.66-.84.03-1.85.56-2.45 1.26-.54.62-1.01 1.61-.88 2.57.93.07 1.89-.47 2.47-1.17" />
    </svg>
  );
}

const buttonBase =
  "flex h-12 w-full items-center justify-center gap-2.5 rounded-full border border-border bg-surface-2 px-4 text-sm font-medium text-text transition-colors hover:border-border-soft hover:bg-surface-3 focus-visible:outline-2 focus-visible:outline-brand focus-visible:outline-offset-2 disabled:opacity-50";

export function AuthProviderButton({
  glyph,
  children,
  onClick,
  disabled,
  ref,
}: {
  glyph: React.ReactNode;
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  ref?: React.Ref<HTMLButtonElement>;
}) {
  return (
    <button
      type="button"
      ref={ref}
      onClick={onClick}
      disabled={disabled}
      className={buttonBase}
    >
      <span className="flex h-[18px] w-[18px] items-center justify-center">
        {glyph}
      </span>
      {children}
    </button>
  );
}

/**
 * Google + Apple options shared by the entry modal and the login page.
 * `onSelect` fires for either provider (mock OAuth is instant).
 */
export function SocialAuthButtons({
  onSelect,
  disabled,
  firstRef,
}: {
  onSelect: () => void;
  disabled?: boolean;
  firstRef?: React.Ref<HTMLButtonElement>;
}) {
  return (
    <div className="flex flex-col gap-2.5">
      <AuthProviderButton ref={firstRef} glyph={<GoogleGlyph />} onClick={onSelect} disabled={disabled}>
        Continue with Google
      </AuthProviderButton>
      <AuthProviderButton glyph={<AppleGlyph />} onClick={onSelect} disabled={disabled}>
        Continue with Apple
      </AuthProviderButton>
    </div>
  );
}

/** The "@ Sign up with Email" affordance that leaves the modal for the email page. */
export function EmailAuthButton({
  onClick,
  disabled,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(buttonBase)}
    >
      <span className="flex h-[18px] w-[18px] items-center justify-center">
        <AtSign className="h-[18px] w-[18px]" aria-hidden />
      </span>
      {children}
    </button>
  );
}
