"use client";

import { ArrowLeft, ArrowRight, Loader2, Wallet, X } from "lucide-react";
import * as React from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { useMockStore } from "@/lib/mock/store";
import { cn } from "@/lib/utils";

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

type Step = "methods" | "email" | "otp";
type Mode = "signup" | "login";

/* -------------------------------------------------------------------------- */
/* Brand glyphs                                                                 */
/* -------------------------------------------------------------------------- */

function GoogleGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
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
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden>
      <path d="M16.36 12.78c.02 2.5 2.19 3.33 2.21 3.34-.02.06-.35 1.2-1.15 2.37-.69 1.02-1.41 2.03-2.54 2.05-1.11.02-1.47-.66-2.74-.66-1.27 0-1.66.64-2.71.68-1.09.04-1.92-1.1-2.62-2.12-1.42-2.06-2.51-5.83-1.05-8.37.72-1.27 2.01-2.07 3.41-2.09 1.07-.02 2.08.72 2.74.72.65 0 1.88-.89 3.17-.76.54.02 2.06.22 3.03 1.64-.08.05-1.81 1.06-1.8 3.16M14.28 4.5c.58-.7.97-1.68.86-2.66-.84.03-1.85.56-2.45 1.26-.54.62-1.01 1.61-.88 2.57.93.07 1.89-.47 2.47-1.17" />
    </svg>
  );
}

function MethodButton({
  children,
  glyph,
  onClick,
  disabled,
  ref,
}: {
  children: React.ReactNode;
  glyph: React.ReactNode;
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
      className={cn(
        "flex w-full items-center gap-3 rounded-[var(--radius)] border border-border bg-surface-2 px-4 py-2.5 text-sm font-medium text-text transition-colors",
        "hover:border-border-soft hover:bg-surface-3 disabled:opacity-50",
      )}
    >
      <span className="flex h-4 w-4 items-center justify-center">{glyph}</span>
      {children}
    </button>
  );
}

/* -------------------------------------------------------------------------- */
/* Login modal                                                                  */
/* -------------------------------------------------------------------------- */

export function LoginModal() {
  const open = useMockStore((s) => s.loginOpen);
  const close = useMockStore((s) => s.closeLogin);
  const signIn = useMockStore((s) => s.signIn);

  const [step, setStep] = React.useState<Step>("methods");
  const [mode, setMode] = React.useState<Mode>("signup");
  const [email, setEmail] = React.useState("");
  const [code, setCode] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  const firstButtonRef = React.useRef<HTMLButtonElement>(null);

  // Fresh state every time the modal opens.
  React.useEffect(() => {
    if (open) {
      setStep("methods");
      setMode("signup");
      setEmail("");
      setCode("");
      setBusy(false);
    }
  }, [open]);

  // Focus the first action when the methods screen is visible.
  React.useEffect(() => {
    if (open && step === "methods") {
      firstButtonRef.current?.focus();
    }
  }, [open, step]);

  const emailValid = EMAIL_RE.test(email.trim());

  function sendCode() {
    if (!emailValid || busy) return;
    setBusy(true);
    // Simulate Privy emailing the one-time code.
    setTimeout(() => {
      setBusy(false);
      setStep("otp");
    }, 650);
  }

  function complete() {
    if (busy) return;
    setBusy(true);
    // Simulate Privy verifying the code and provisioning the account.
    setTimeout(() => signIn(), 650);
  }

  const heading = mode === "signup" ? "Create your account" : "Welcome back";
  const subheading =
    mode === "signup"
      ? "Join the v1 Genesis cohort. It takes a minute."
      : "Sign in to continue your evaluation.";
  const emailButtonLabel =
    mode === "signup" ? "Sign up with Email" : "Continue with Email";

  return (
    <Modal open={open} onClose={close} hideClose className="max-w-[400px]">
      <div className="flex flex-col">
        {/* Close button */}
        <div className="mb-6 flex justify-end">
          <button
            type="button"
            onClick={close}
            aria-label="Close"
            className="rounded-sm p-1 text-text-muted transition-colors hover:bg-surface-2 hover:text-text"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Heading */}
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-text">{heading}</h2>
          <p className="mt-1 text-sm text-text-muted">{subheading}</p>
        </div>

        {step === "methods" && (
          <>
            {/* Primary auth options */}
            <div className="flex flex-col gap-2.5">
              <MethodButton
                ref={firstButtonRef}
                glyph={<GoogleGlyph />}
                onClick={complete}
                disabled={busy}
              >
                Continue with Google
              </MethodButton>
              <MethodButton
                glyph={<AppleGlyph />}
                onClick={complete}
                disabled={busy}
              >
                Continue with Apple
              </MethodButton>
              <MethodButton
                glyph={
                  <svg viewBox="0 0 16 16" className="h-4 w-4" fill="currentColor" aria-hidden>
                    <path d="M2.5 3A1.5 1.5 0 0 0 1 4.5v.793c.026.009.051.02.076.032L7.674 8.51c.206.1.446.1.652 0l6.598-3.185A.755.755 0 0 1 15 5.293V4.5A1.5 1.5 0 0 0 13.5 3h-11Z" />
                    <path d="M15 6.954 8.978 9.86a2.25 2.25 0 0 1-1.956 0L1 6.954V11.5A1.5 1.5 0 0 0 2.5 13h11a1.5 1.5 0 0 0 1.5-1.5V6.954Z" />
                  </svg>
                }
                onClick={() => setStep("email")}
                disabled={busy}
              >
                {emailButtonLabel}
              </MethodButton>
            </div>

            {/* Wallet option (de-emphasized) */}
            <div className="my-4 flex items-center gap-3">
              <div className="h-px flex-1 bg-border" />
              <span className="text-xs text-text-faint">or</span>
              <div className="h-px flex-1 bg-border" />
            </div>
            <MethodButton
              glyph={<Wallet className="h-4 w-4 text-violet" />}
              onClick={complete}
              disabled={busy}
            >
              <span className="text-text-muted">Continue with a wallet</span>
            </MethodButton>

            {/* Legal */}
            <p className="mt-5 text-center text-[11px] text-text-faint">
              By continuing, you agree to the{" "}
              <span className="text-text-muted">Terms</span> and{" "}
              <span className="text-text-muted">Privacy Policy</span>.
            </p>

            {/* Mode toggle */}
            <p className="mt-3 text-center text-xs text-text-muted">
              {mode === "signup" ? (
                <>
                  Already have an account?{" "}
                  <button
                    type="button"
                    onClick={() => setMode("login")}
                    className="font-medium text-indigo-400 transition-colors hover:text-indigo-300"
                  >
                    Log in
                  </button>
                </>
              ) : (
                <>
                  New here?{" "}
                  <button
                    type="button"
                    onClick={() => setMode("signup")}
                    className="font-medium text-indigo-400 transition-colors hover:text-indigo-300"
                  >
                    Create an account
                  </button>
                </>
              )}
            </p>
          </>
        )}

        {step === "email" && (
          <>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                sendCode();
              }}
              className="flex flex-col gap-2"
            >
              <label
                htmlFor="login-email"
                className="text-xs font-medium text-text-muted"
              >
                Email
              </label>
              <Input
                id="login-email"
                type="email"
                inputMode="email"
                autoComplete="email"
                autoFocus
                placeholder="you@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <Button
                type="submit"
                variant="primary"
                disabled={!emailValid || busy}
                className="mt-1 w-full"
              >
                {busy ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <span className="flex items-center gap-1.5">
                    Continue <ArrowRight className="h-4 w-4" />
                  </span>
                )}
              </Button>
            </form>
            <button
              type="button"
              onClick={() => setStep("methods")}
              className="mt-3 flex w-fit items-center gap-1 text-xs text-text-muted transition-colors hover:text-text"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Back
            </button>
          </>
        )}

        {step === "otp" && (
          <div className="flex flex-col gap-3">
            <button
              type="button"
              onClick={() => setStep("email")}
              className="flex w-fit items-center gap-1 text-xs text-text-muted transition-colors hover:text-text"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Back
            </button>
            <p className="text-sm text-text-muted">
              Enter the 6-digit code sent to{" "}
              <span className="font-medium text-text">{email}</span>
            </p>
            <Input
              mono
              inputMode="numeric"
              autoFocus
              maxLength={6}
              placeholder="······"
              value={code}
              onChange={(e) =>
                setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
              }
              className="text-center text-xl tracking-[0.5em]"
              aria-label="One-time code"
            />
            <Button
              type="button"
              variant="primary"
              disabled={code.length < 6 || busy}
              onClick={complete}
              className="w-full"
            >
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Verify and continue"
              )}
            </Button>
            <button
              type="button"
              onClick={sendCode}
              className="text-center text-xs text-text-muted transition-colors hover:text-text"
            >
              Resend code
            </button>
          </div>
        )}

        {/* Privy footnote */}
        <p className="mt-5 text-center text-[11px] text-text-faint">
          Protected by <span className="text-text-muted">Privy</span> · a
          secure account is created for you
        </p>
      </div>
    </Modal>
  );
}
