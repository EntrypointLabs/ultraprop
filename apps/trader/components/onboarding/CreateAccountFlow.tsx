"use client";

import { usePrivy } from "@privy-io/react-auth";
import { Check, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { AuthHeading, AuthShell } from "@/components/auth/AuthShell";
import { Button } from "@/components/ui/Button";
import { suiWalletAddress } from "@/lib/auth";
import {
  useCreateAccount,
  useTradingAccount,
} from "@/lib/sui/useTradingAccount";

const POINTS = [
  "A funded evaluation account, opened on the firm's published terms.",
  "Every trade is recorded transparently and can't be altered after the fact.",
  "Clear the evaluation to unlock payouts on your profit share.",
];

function FullScreenLoader({ label }: { label: string }) {
  return (
    <AuthShell>
      <div className="flex flex-col items-center gap-3 pt-10 text-text-muted">
        <Loader2 className="h-6 w-6 animate-spin" aria-hidden />
        <p className="text-sm">{label}</p>
      </div>
    </AuthShell>
  );
}

/**
 * Post-login account setup. First-time traders land here to open their trading
 * account; returning traders who already have one are passed straight through to
 * the app. Account creation is firm-signed server-side, so this screen only
 * needs the trader's authenticated session and provisioned wallet.
 */
export function CreateAccountFlow() {
  const router = useRouter();
  const { ready, authenticated, user } = usePrivy();
  const suiAddress = suiWalletAddress(user);
  const account = useTradingAccount(suiAddress);
  const create = useCreateAccount();

  React.useEffect(() => {
    if (ready && !authenticated) router.replace("/login");
  }, [ready, authenticated, router]);

  React.useEffect(() => {
    if (account.data) router.replace("/markets");
  }, [account.data, router]);

  if (!ready || !authenticated) {
    return <FullScreenLoader label="Loading your session…" />;
  }
  // Holds an account already, or the check is still running: bounce/wait.
  if (account.data || (suiAddress && account.isLoading)) {
    return <FullScreenLoader label="Checking your account…" />;
  }

  const provisioning = !suiAddress;
  const busy = create.isPending;

  async function open() {
    if (!suiAddress || busy) return;
    try {
      await create.mutateAsync(suiAddress);
      router.replace("/markets");
    } catch {
      // Surfaced below via create.error; the button stays available for retry.
    }
  }

  return (
    <AuthShell>
      <div className="auth-step-in">
        <AuthHeading
          title="Set up your account"
          subtitle="One quick step before you trade. We'll open your Genesis evaluation account. It only takes a moment."
        />

        <ul className="flex flex-col gap-3">
          {POINTS.map((point) => (
            <li key={point} className="flex items-start gap-3">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand/15 text-brand">
                <Check className="h-3.5 w-3.5" aria-hidden />
              </span>
              <span className="text-pretty text-sm leading-relaxed text-text-muted">
                {point}
              </span>
            </li>
          ))}
        </ul>

        {create.error && (
          <p role="alert" className="mt-6 text-sm text-down">
            {create.error instanceof Error
              ? create.error.message
              : "We couldn't open your account. Please try again."}
          </p>
        )}

        <Button
          type="button"
          variant="primary"
          onClick={open}
          disabled={provisioning || busy}
          className="mt-8 h-14 w-full rounded-full text-base"
        >
          {busy ? (
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
          ) : create.error ? (
            "Try again"
          ) : (
            "Open my account"
          )}
        </Button>

        <p
          role="status"
          aria-live="polite"
          className="mt-3 min-h-5 text-center text-xs text-text-muted"
        >
          {provisioning
            ? "Preparing your account…"
            : busy
              ? "Opening your account…"
              : ""}
        </p>

        <p className="mt-4 text-center text-sm">
          <button
            type="button"
            onClick={() => router.push("/markets")}
            className="text-text-muted underline-offset-2 transition-colors hover:text-text hover:underline"
          >
            I'll do this later
          </button>
        </p>
      </div>
    </AuthShell>
  );
}
