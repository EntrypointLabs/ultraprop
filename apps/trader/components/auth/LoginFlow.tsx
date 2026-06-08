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
import { SocialAuthButtons } from "@/components/auth/social";
import { Button } from "@/components/ui/Button";
import { useMockStore } from "@/lib/mock/store";

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export function LoginFlow() {
  const router = useRouter();
  const signIn = useMockStore((s) => s.signIn);

  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);

  const valid = EMAIL_RE.test(email.trim()) && password.length > 0;

  function authenticate() {
    if (submitting) return;
    setSubmitting(true);
    window.setTimeout(() => {
      signIn();
      router.push("/markets");
    }, 700);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (valid) authenticate();
  }

  return (
    <AuthShell onBack={() => router.push("/")}>
      <AuthHeading
        title="Welcome back"
        subtitle="Sign in to pick up your evaluation."
      />

      <SocialAuthButtons onSelect={authenticate} disabled={submitting} />

      <div className="my-5 flex items-center gap-3">
        <span className="h-px flex-1 bg-border" />
        <span className="text-xs text-text-faint">or</span>
        <span className="h-px flex-1 bg-border" />
      </div>

      <form onSubmit={submit} noValidate>
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
            onChange={setEmail}
          />
          <AuthField
            id="login-password"
            label="Password"
            autoComplete="current-password"
            reveal
            value={password}
            onChange={setPassword}
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
          disabled={!valid || submitting}
          className="mt-4 h-14 w-full rounded-full text-base"
        >
          {submitting ? (
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
    </AuthShell>
  );
}
