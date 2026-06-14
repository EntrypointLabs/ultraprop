"use client";

import { CheckCircle2, Loader2 } from "lucide-react";
import Link from "next/link";
import { ProfileSection } from "@/components/profile/ProfileSection";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { useAccountSetup, useCreateAccount } from "@/lib/sui/useTradingAccount";
import { shortAddress } from "@/lib/utils";

/**
 * The trader's on-chain account, surfaced on their own profile. When setup is
 * incomplete this is where "I'll do this later" resolves — the same firm-signed
 * creation the onboarding screen runs, available any time.
 */
export function TradingAccountSection() {
  const setup = useAccountSetup();
  const create = useCreateAccount();
  const busy = create.isPending;

  async function open() {
    if (!setup.suiAddress || busy) return;
    try {
      await create.mutateAsync(setup.suiAddress);
    } catch {
      // Surfaced below via create.error; the button stays available for retry.
    }
  }

  const badge = setup.checking ? null : setup.hasAccount ? (
    <Badge variant="up">Active</Badge>
  ) : (
    <Badge variant="pending">Setup incomplete</Badge>
  );

  return (
    <ProfileSection title="Trading account" action={badge}>
      <Card>
        <CardContent>
          {setup.checking ? (
            <div className="flex items-center gap-2 text-sm text-text-muted">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              Checking your account…
            </div>
          ) : setup.hasAccount ? (
            <div className="flex flex-col gap-4">
              <div className="flex items-start gap-3">
                <CheckCircle2
                  className="mt-0.5 h-5 w-5 shrink-0 text-up"
                  aria-hidden
                />
                <div>
                  <p className="text-sm text-text">
                    Your trading account is ready.
                  </p>
                  {setup.accountId && (
                    <p className="mt-0.5 font-mono text-xs text-text-muted">
                      {shortAddress(setup.accountId)}
                    </p>
                  )}
                </div>
              </div>
              <Link
                href="/markets"
                className="inline-flex h-9 w-fit items-center rounded-[var(--radius)] border border-border px-4 text-sm font-medium text-text transition-colors hover:bg-surface-2"
              >
                Go to markets
              </Link>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <p className="text-sm leading-relaxed text-text-muted">
                You haven&apos;t opened your trading account yet. We&apos;ll
                open your Genesis evaluation account on the firm&apos;s
                published terms so you can start trading. It only takes a
                moment.
              </p>

              {create.error && (
                <p role="alert" className="text-sm text-down">
                  {create.error instanceof Error
                    ? create.error.message
                    : "We couldn't open your account. Please try again."}
                </p>
              )}

              <div className="flex items-center gap-3">
                <Button
                  type="button"
                  variant="primary"
                  onClick={open}
                  disabled={setup.provisioning || busy}
                >
                  {busy ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  ) : create.error ? (
                    "Try again"
                  ) : (
                    "Open my account"
                  )}
                </Button>
                <span
                  role="status"
                  aria-live="polite"
                  className="text-xs text-text-muted"
                >
                  {setup.provisioning
                    ? "Preparing your account…"
                    : busy
                      ? "Opening your account…"
                      : ""}
                </span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </ProfileSection>
  );
}
