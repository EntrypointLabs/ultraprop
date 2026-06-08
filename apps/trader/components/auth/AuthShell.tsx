"use client";

import { ArrowLeft, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";
import { Logo } from "@/components/shell/Logo";
import { cn } from "@/lib/utils";

interface AuthShellProps {
  /** 1-based index of the current step; omit for single-screen surfaces like login. */
  step?: number;
  totalSteps?: number;
  /** Back-arrow handler. Omit to hide the arrow. */
  onBack?: () => void;
  children: React.ReactNode;
}

export function AuthShell({ step, totalSteps, onBack, children }: AuthShellProps) {
  const router = useRouter();
  const showProgress = step != null && totalSteps != null && totalSteps > 1;

  return (
    <div className="relative flex min-h-dvh flex-col bg-bg">
      {showProgress && (
        <div className="absolute inset-x-0 top-0 z-20 flex gap-1.5 px-3 pt-3">
          {Array.from({ length: totalSteps }).map((_, i) => (
            <span
              key={i}
              className={cn(
                "h-[3px] flex-1 rounded-full transition-colors duration-500 ease-out",
                i < (step ?? 0) ? "bg-brand" : "bg-border",
              )}
            />
          ))}
        </div>
      )}

      <header className="relative z-10 flex h-16 items-center px-3 sm:px-5">
        <div className="flex flex-1 justify-start">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              aria-label="Go back"
              className="-ml-2 rounded-full p-2 text-text-muted transition-colors hover:bg-surface-2 hover:text-text"
            >
              <ArrowLeft className="h-5 w-5" aria-hidden />
            </button>
          )}
        </div>
        <Link href="/" aria-label="Ultraprop home" className="shrink-0">
          <Logo size={22} />
        </Link>
        <div className="flex flex-1 justify-end">
          <button
            type="button"
            onClick={() => router.push("/")}
            aria-label="Close and return home"
            className="-mr-2 rounded-full p-2 text-text-muted transition-colors hover:bg-surface-2 hover:text-text"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>
      </header>

      <main
        id="main-content"
        className="flex flex-1 flex-col items-center px-6 pb-16 pt-[10vh] sm:pt-[13vh]"
      >
        <div className="w-full max-w-[420px]">{children}</div>
      </main>
    </div>
  );
}

export function AuthHeading({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: React.ReactNode;
}) {
  return (
    <div className="mb-8">
      <h1 className="text-balance text-3xl font-semibold leading-tight text-text">
        {title}
      </h1>
      {subtitle && (
        <p className="mt-2.5 text-pretty text-base leading-relaxed text-text-muted">
          {subtitle}
        </p>
      )}
    </div>
  );
}

export function AuthLegal({ className }: { className?: string }) {
  return (
    <p
      className={cn(
        "mt-6 text-center text-xs leading-relaxed text-text-faint",
        className,
      )}
    >
      By continuing you agree to our{" "}
      <a
        href="#"
        className="text-text-muted underline-offset-2 hover:text-text hover:underline"
      >
        Terms
      </a>{" "}
      and{" "}
      <a
        href="#"
        className="text-text-muted underline-offset-2 hover:text-text hover:underline"
      >
        Privacy Policy
      </a>
      .
    </p>
  );
}

/** Full-width pill that links to the other side of the auth flow. */
export function AuthSecondaryLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="flex h-12 w-full items-center justify-center rounded-full border border-border text-sm font-medium text-text transition-colors hover:bg-surface-2"
    >
      {children}
    </Link>
  );
}
