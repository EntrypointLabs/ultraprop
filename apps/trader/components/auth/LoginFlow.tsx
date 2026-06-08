"use client";

import { useLoginWithEmail, useLoginWithOAuth } from "@privy-io/react-auth";
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
import {
  type OAuthProvider,
  SocialAuthButtons,
} from "@/components/auth/social";
import { Button } from "@/components/ui/Button";
import { authErrorMessage } from "@/lib/auth";

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const OTP_LENGTH = 6;
const RESEND_COOLDOWN_S = 30;

export function LoginFlow() {
  const router = useRouter();
  // After auth, route through onboarding; it opens a trading account for
  // first-time traders and passes returning ones straight to the app.
  const afterAuth = () => router.push("/onboarding");

  // Email OTP is the real factor; the password field is collected for parity
  // with the expected flow. Privy itself is passwordless.
  const { sendCode, loginWithCode } = useLoginWithEmail({
    onComplete: afterAuth,
  });
  const { initOAuth, state: oauthState } = useLoginWithOAuth({
    onComplete: afterAuth,
    onError: (err) =>
      setFormError(authErrorMessage(err, "Sign-in failed. Try again.")),
  });

  const [phase, setPhase] = React.useState<"form" | "verify">("form");
  const [email, setEmail] = React.useState("");
  const [emailError, setEmailError] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [formError, setFormError] = React.useState("");
  const [code, setCode] = React.useState("");
  const [codeError, setCodeError] = React.useState("");
  const [resentNote, setResentNote] = React.useState("");
  const [otpNonce, setOtpNonce] = React.useState(0);
  const [cooldown, setCooldown] = React.useState(0);
  const [sending, setSending] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);

  const emailValid = EMAIL_RE.test(email.trim());
  const valid = emailValid && password.length > 0;
  const codeValid = code.length >= OTP_LENGTH;
  const oauthBusy = oauthState.status === "loading";

  React.useEffect(() => {
    if (cooldown <= 0) return;
    const id = window.setInterval(
      () => setCooldown((c) => Math.max(0, c - 1)),
      1000,
    );
    return () => window.clearInterval(id);
  }, [cooldown]);

  function social(provider: OAuthProvider) {
    if (oauthBusy) return;
    setFormError("");
    initOAuth({ provider }).catch((err) =>
      setFormError(authErrorMessage(err, "Sign-in failed. Try again.")),
    );
  }

  async function submitCredentials(e: React.SyntheticEvent) {
    e.preventDefault();
    if (!valid || sending) return;
    setSending(true);
    setFormError("");
    try {
      await sendCode({ email: email.trim() });
      setCooldown(RESEND_COOLDOWN_S);
      setPhase("verify");
    } catch (err) {
      setFormError(
        authErrorMessage(
          err,
          "Could not send a code. Check your email and retry.",
        ),
      );
    } finally {
      setSending(false);
    }
  }

  async function verify(e: React.SyntheticEvent) {
    e.preventDefault();
    if (!codeValid || submitting) return;
    setSubmitting(true);
    setCodeError("");
    setResentNote("");
    try {
      await loginWithCode({ code });
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
    <AuthShell
      onBack={() => (phase === "verify" ? setPhase("form") : router.push("/"))}
    >
      {phase === "form" ? (
        <div className="auth-step-in">
          <AuthHeading
            title="Welcome back"
            subtitle="Sign in to pick up your evaluation."
          />

          <SocialAuthButtons onSelect={social} disabled={oauthBusy} />

          <div className="my-5 flex items-center gap-3">
            <span className="h-px flex-1 bg-border" />
            <span className="text-xs text-text-muted">or</span>
            <span className="h-px flex-1 bg-border" />
          </div>

          <form onSubmit={submitCredentials} noValidate>
            {formError && (
              <p
                role="alert"
                className="mb-3 rounded-[var(--radius)] border border-down/40 bg-down/10 px-3 py-2 text-sm text-down"
              >
                {formError}
              </p>
            )}
            <div className="flex flex-col gap-3">
              <AuthField
                id="login-email"
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
                  if (formError) setFormError("");
                }}
                onBlur={() =>
                  setEmailError(
                    email.trim() && !emailValid
                      ? "Enter a valid email address."
                      : "",
                  )
                }
              />
              <AuthField
                id="login-password"
                label="Password"
                autoComplete="current-password"
                reveal
                value={password}
                onChange={(v) => {
                  setPassword(v);
                  if (formError) setFormError("");
                }}
              />
            </div>
            <div className="mt-2.5 flex justify-end">
              <a
                href="#"
                className="text-sm text-text-muted underline-offset-2 transition-colors hover:text-text hover:underline"
              >
                Forgot password?
              </a>
            </div>
            <Button
              type="submit"
              variant="primary"
              disabled={!valid || sending}
              className="mt-4 h-14 w-full rounded-full text-base"
            >
              {sending ? (
                <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
              ) : (
                "Log in"
              )}
            </Button>
          </form>

          <div className="mt-3">
            <AuthSecondaryLink href="/signup">
              No account? Create one
            </AuthSecondaryLink>
          </div>
          <AuthLegal />
        </div>
      ) : (
        <form onSubmit={verify} noValidate className="auth-step-in">
          <AuthHeading
            title="Enter your code"
            subtitle={
              <>
                We sent a {OTP_LENGTH}-digit code to{" "}
                <span className="break-all font-medium text-text">{email}</span>
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
            className="mt-6 h-14 w-full rounded-full text-base"
          >
            {submitting ? (
              <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
            ) : (
              "Log in"
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
    </AuthShell>
  );
}
