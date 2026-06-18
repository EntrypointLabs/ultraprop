"use client";

import { useLoginWithEmail } from "@privy-io/react-auth";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { AuthField } from "@/components/auth/AuthField";
import {
  AuthHeading,
  AuthLegal,
  AuthSecondaryLink,
  AuthShell,
} from "@/components/auth/AuthShell";
import { OtpInput } from "@/components/auth/OtpInput";
import { Button } from "@/components/ui/Button";
import { authErrorMessage } from "@/lib/auth";

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const STEPS = ["email", "verify"] as const;
type Step = (typeof STEPS)[number];

const OTP_LENGTH = 6;
const RESEND_COOLDOWN_S = 30;
const ctaClass = "mt-6 h-14 w-full rounded-full text-base";

export function SignupFlow() {
  const router = useRouter();
  // Privy authenticates by email OTP — it is passwordless, so signup is email
  // then code, with no password step.
  const { sendCode, loginWithCode } = useLoginWithEmail({
    onComplete: () => router.push("/onboarding"),
  });

  const [step, setStep] = React.useState<Step>("email");
  const [email, setEmail] = React.useState("");
  const [emailError, setEmailError] = React.useState("");
  const [sendError, setSendError] = React.useState("");
  const [code, setCode] = React.useState("");
  const [codeError, setCodeError] = React.useState("");
  const [resentNote, setResentNote] = React.useState("");
  const [otpNonce, setOtpNonce] = React.useState(0);
  const [cooldown, setCooldown] = React.useState(0);
  const [sending, setSending] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);

  const stepIndex = STEPS.indexOf(step);
  const emailValid = EMAIL_RE.test(email.trim());
  const codeValid = code.length >= OTP_LENGTH;

  React.useEffect(() => {
    if (cooldown <= 0) return;
    const id = window.setInterval(
      () => setCooldown((c) => Math.max(0, c - 1)),
      1000,
    );
    return () => window.clearInterval(id);
  }, [cooldown]);

  function back() {
    if (step === "verify") setStep("email");
    else router.push("/");
  }

  function validateEmailOnBlur() {
    setEmailError(
      email.trim() && !emailValid ? "Enter a valid email address." : "",
    );
  }

  async function continueFromEmail(e: React.SyntheticEvent) {
    e.preventDefault();
    if (!emailValid) {
      setEmailError("Enter a valid email address.");
      return;
    }
    if (sending) return;
    setSending(true);
    setSendError("");
    try {
      await sendCode({ email: email.trim() });
      setCooldown(RESEND_COOLDOWN_S);
      setStep("verify");
    } catch (err) {
      setSendError(
        authErrorMessage(
          err,
          "Could not send a code. Check the email and retry.",
        ),
      );
    } finally {
      setSending(false);
    }
  }

  async function finish(e: React.SyntheticEvent) {
    e.preventDefault();
    if (!codeValid || submitting) return;
    setSubmitting(true);
    setCodeError("");
    setResentNote("");
    try {
      await loginWithCode({ code });
      // onComplete navigates to /markets; keep the button busy through nav.
    } catch {
      setSubmitting(false);
      setCodeError("That code didn't match. Check it and try again.");
      setCode("");
      setOtpNonce((n) => n + 1);
    }
  }

  async function resend() {
    if (cooldown > 0 || sending) return;
    setCode("");
    setCodeError("");
    setResentNote("");
    try {
      await sendCode({ email: email.trim() });
      setResentNote("A new code is on its way to your email.");
      setOtpNonce((n) => n + 1);
      setCooldown(RESEND_COOLDOWN_S);
    } catch (err) {
      setCodeError(authErrorMessage(err, "Could not resend the code."));
    }
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
                if (sendError) setSendError("");
              }}
              onBlur={validateEmailOnBlur}
            />
            {sendError && (
              <p role="alert" className="mt-3 text-sm text-down">
                {sendError}
              </p>
            )}
            <Button
              type="submit"
              variant="primary"
              disabled={!emailValid || sending}
              className={ctaClass}
            >
              {sending ? (
                <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
              ) : (
                "Continue"
              )}
            </Button>
            <div className="mt-3">
              <AuthSecondaryLink href="/login">
                Already have an account? Log in
              </AuthSecondaryLink>
            </div>
            <AuthLegal />
          </form>
        )}

        {step === "verify" && (
          <form onSubmit={finish} noValidate>
            <AuthHeading
              title="Enter your code"
              subtitle={
                <>
                  We sent a {OTP_LENGTH}-digit code to{" "}
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
              length={OTP_LENGTH}
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
