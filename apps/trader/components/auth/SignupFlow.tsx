"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import {
  AuthHeading,
  AuthLegal,
  AuthSecondaryLink,
  AuthShell,
} from "@/components/auth/AuthShell";
import { AuthField } from "@/components/auth/AuthField";
import { OtpInput } from "@/components/auth/OtpInput";
import {
  isPasswordValid,
  PasswordChecklist,
} from "@/components/auth/PasswordChecklist";
import { Button } from "@/components/ui/Button";
import { useMockStore } from "@/lib/mock/store";

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const STEPS = ["email", "password", "verify"] as const;
type Step = (typeof STEPS)[number];

// Code that the mock verifier rejects, so the error state is reachable in a demo.
const REJECTED_CODE = "0000";
const RESEND_COOLDOWN_S = 20;

const ctaClass = "mt-6 h-14 w-full rounded-full text-base";

export function SignupFlow() {
  const router = useRouter();
  const signIn = useMockStore((s) => s.signIn);

  const [step, setStep] = React.useState<Step>("email");
  const [email, setEmail] = React.useState("");
  const [emailError, setEmailError] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [code, setCode] = React.useState("");
  const [codeError, setCodeError] = React.useState("");
  const [resentNote, setResentNote] = React.useState("");
  const [otpNonce, setOtpNonce] = React.useState(0);
  const [cooldown, setCooldown] = React.useState(0);
  const [sending, setSending] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);

  const stepIndex = STEPS.indexOf(step);
  const emailValid = EMAIL_RE.test(email.trim());
  const passwordValid = isPasswordValid(password);
  const codeValid = code.length >= 4;

  // Resend cooldown ticker.
  React.useEffect(() => {
    if (cooldown <= 0) return;
    const id = window.setInterval(
      () => setCooldown((c) => Math.max(0, c - 1)),
      1000,
    );
    return () => window.clearInterval(id);
  }, [cooldown]);

  function back() {
    if (step === "verify") setStep("password");
    else if (step === "password") setStep("email");
    else router.push("/");
  }

  function validateEmailOnBlur() {
    setEmailError(
      email.trim() && !emailValid ? "Enter a valid email address." : "",
    );
  }

  function continueFromEmail(e: React.SyntheticEvent) {
    e.preventDefault();
    if (!emailValid) {
      setEmailError("Enter a valid email address.");
      return;
    }
    setStep("password");
  }

  function continueFromPassword(e: React.SyntheticEvent) {
    e.preventDefault();
    if (!passwordValid || sending) return;
    setSending(true);
    // Simulate dispatching the verification email.
    window.setTimeout(() => {
      setSending(false);
      setCooldown(RESEND_COOLDOWN_S);
      setStep("verify");
    }, 650);
  }

  function finish(e: React.SyntheticEvent) {
    e.preventDefault();
    if (!codeValid || submitting) return;
    setSubmitting(true);
    setCodeError("");
    setResentNote("");
    // Simulate the verifier round-trip.
    window.setTimeout(() => {
      if (code === REJECTED_CODE) {
        setSubmitting(false);
        setCodeError("That code didn't match. Check it and try again.");
        setCode("");
        setOtpNonce((n) => n + 1); // remount to refocus the first box
        return;
      }
      signIn();
      router.push("/markets");
    }, 700);
  }

  function resend() {
    if (cooldown > 0 || submitting) return;
    setCode("");
    setCodeError("");
    setResentNote("A new code is on its way to your email.");
    setOtpNonce((n) => n + 1);
    setCooldown(RESEND_COOLDOWN_S);
  }

  return (
    <AuthShell step={stepIndex + 1} totalSteps={STEPS.length} onBack={back}>
      <div key={step} className="auth-step-in">
        {step === "email" && (
          <form onSubmit={continueFromEmail} noValidate>
            <AuthHeading
              title="What's your email?"
              subtitle="You'll use this to sign in and to secure your account."
            />
            <AuthField
              id="signup-email"
              label="Email"
              type="email"
              inputMode="email"
              autoComplete="email"
              autoFocus
              spellCheck={false}
              value={email}
              error={emailError}
              onChange={(v) => {
                setEmail(v);
                if (emailError) setEmailError("");
              }}
              onBlur={validateEmailOnBlur}
            />
            <Button
              type="submit"
              variant="primary"
              disabled={!emailValid}
              className={ctaClass}
            >
              Continue
            </Button>
            <div className="mt-3">
              <AuthSecondaryLink href="/login">
                Already have an account? Log in
              </AuthSecondaryLink>
            </div>
            <AuthLegal />
          </form>
        )}

        {step === "password" && (
          <form onSubmit={continueFromPassword} noValidate>
            <AuthHeading
              title="Create a password"
              subtitle="Keep it strong. You can sign in with it any time."
            />
            <AuthField
              id="signup-password"
              label="Password"
              autoComplete="new-password"
              autoFocus
              reveal
              value={password}
              onChange={setPassword}
            />
            <PasswordChecklist password={password} className="mt-4" />
            <Button
              type="submit"
              variant="primary"
              disabled={!passwordValid || sending}
              className={ctaClass}
            >
              {sending ? (
                <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
              ) : (
                "Continue"
              )}
            </Button>
          </form>
        )}

        {step === "verify" && (
          <form onSubmit={finish} noValidate>
            <AuthHeading
              title="Enter your code"
              subtitle={
                <>
                  We sent a 4-digit code to{" "}
                  <span className="break-all font-medium text-text">
                    {email}
                  </span>
                  .
                </>
              }
            />
            <OtpInput
              key={otpNonce}
              value={code}
              onChange={(v) => {
                setCode(v);
                if (codeError) setCodeError("");
              }}
              error={!!codeError}
              length={4}
              autoFocus
            />
            {codeError && (
              <p role="alert" className="mt-3 text-sm text-down">
                {codeError}
              </p>
            )}
            <Button
              type="submit"
              variant="primary"
              disabled={!codeValid || submitting}
              className={ctaClass}
            >
              {submitting ? (
                <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
              ) : (
                "Create account"
              )}
            </Button>
            <p className="mt-5 text-center text-sm text-text-muted">
              {cooldown > 0 ? (
                <span className="text-text-muted">
                  Resend available in {cooldown}s
                </span>
              ) : (
                <>
                  Didn&apos;t get it?{" "}
                  <button
                    type="button"
                    onClick={resend}
                    className="font-medium text-brand transition-colors hover:text-violet-hover"
                  >
                    Resend code
                  </button>
                </>
              )}
            </p>
            <p
              role="status"
              aria-live="polite"
              className="mt-2 min-h-5 text-center text-sm text-up"
            >
              {resentNote}
            </p>
          </form>
        )}
      </div>
    </AuthShell>
  );
}
