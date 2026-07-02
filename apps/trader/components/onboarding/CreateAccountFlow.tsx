"use client";

import { usePrivy } from "@privy-io/react-auth";
import { Check, Loader2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import * as React from "react";
import { AuthHeading, AuthShell } from "@/components/auth/AuthShell";
import { Redirect } from "@/components/Redirect";
import { Button } from "@/components/ui/Button";
import { suiWalletAddress } from "@/lib/auth";
import { isOnboardingPaymentConfigured, type TierName } from "@/lib/sui/config";
import {
  useGetTestUsdc,
  usePayAndStart,
  useRedeemInvite,
} from "@/lib/sui/useOnboard";
import { useSuiWalletProvision } from "@/lib/sui/useSuiWalletProvision";
import { useTradingAccount } from "@/lib/sui/useTradingAccount";
import { cn } from "@/lib/utils";

interface TierOption {
  id: TierName;
  name: string;
  fee: string;
  size: string;
  blurb: string;
}

const TIERS: readonly TierOption[] = [
  {
    id: "starter",
    name: "Starter",
    fee: "$100",
    size: "$10k",
    blurb: "Evaluate on a $10k funded account.",
  },
  {
    id: "basic",
    name: "Basic",
    fee: "$250",
    size: "$25k",
    blurb: "More size and a higher profit split.",
  },
];

/** Only the self-serve tiers can be preselected via `?tier=`. */
function parsePreselectedTier(value: string | null): TierName {
  return value === "basic" ? "basic" : "starter";
}

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

function errorText(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

/**
 * Post-login onboarding. The trader picks a tier and pays their evaluation fee
 * with test USDC (the PAID path), or redeems an invite code (Starter, firm-
 * funded). No account is opened automatically: account creation only happens
 * after a verified payment or a valid invite. Returning traders who already hold
 * an account are passed straight through to the app.
 */
export function CreateAccountFlow() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { ready, authenticated, user } = usePrivy();
  const suiAddress = suiWalletAddress(user);
  const account = useTradingAccount(suiAddress);
  const wallet = useSuiWalletProvision();

  const [tier, setTier] = React.useState<TierName>(() =>
    parsePreselectedTier(searchParams.get("tier")),
  );
  const [funded, setFunded] = React.useState(false);
  const [inviteOpen, setInviteOpen] = React.useState(false);
  const [inviteCode, setInviteCode] = React.useState("");

  const getUsdc = useGetTestUsdc();
  const pay = usePayAndStart();
  const redeem = useRedeemInvite();

  const paymentConfigured = isOnboardingPaymentConfigured();

  if (ready && !authenticated) return <Redirect href="/login" />;
  if (account.data) return <Redirect href="/markets" />;

  if (!ready || !authenticated) {
    return <FullScreenLoader label="Loading your session…" />;
  }
  if (account.data || (suiAddress && account.isLoading)) {
    return <FullScreenLoader label="Checking your account…" />;
  }

  const provisioning = !suiAddress;
  const walletFailed = provisioning && !wallet.pending && wallet.error != null;
  const busy = getUsdc.isPending || pay.isPending || redeem.isPending;

  async function onGetUsdc() {
    try {
      await getUsdc.mutateAsync(tier);
      setFunded(true);
    } catch {
      // Surfaced below via getUsdc.error.
    }
  }

  async function onPay() {
    try {
      await pay.mutateAsync(tier);
      router.replace("/markets");
    } catch {
      // Surfaced below via pay.error.
    }
  }

  async function onRedeem(e: React.FormEvent) {
    e.preventDefault();
    if (!inviteCode.trim() || redeem.isPending) return;
    try {
      await redeem.mutateAsync(inviteCode.trim());
      router.replace("/markets");
    } catch {
      // Surfaced below via redeem.error.
    }
  }

  if (walletFailed) {
    return (
      <AuthShell>
        <div className="auth-step-in">
          <AuthHeading
            title="We couldn't set up your wallet"
            subtitle="Onboarding needs a Sui wallet to continue. Try again."
          />
          <p role="alert" className="mb-6 text-sm text-down">
            {wallet.error}
          </p>
          <Button
            type="button"
            variant="primary"
            onClick={() => wallet.retry()}
            className="h-14 w-full rounded-full text-base"
          >
            Try again
          </Button>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <div className="auth-step-in">
        <AuthHeading
          title="Choose your evaluation"
          subtitle="Pay your evaluation fee in test USDC to open your account. Every trade is recorded and can't be altered after the fact."
        />

        <div className="flex flex-col gap-3" role="radiogroup" aria-label="Tier">
          {TIERS.map((option) => {
            const selected = tier === option.id;
            return (
              <button
                key={option.id}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => {
                  setTier(option.id);
                  setFunded(false);
                }}
                disabled={busy}
                className={cn(
                  "flex items-center justify-between rounded-2xl border p-4 text-left transition-colors",
                  selected
                    ? "border-violet bg-violet/10"
                    : "border-border hover:bg-surface-2",
                )}
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-base font-semibold text-text">
                      {option.name}
                    </span>
                    <span className="text-sm text-text-muted">
                      {option.size} account
                    </span>
                  </div>
                  <p className="mt-0.5 text-sm text-text-muted">
                    {option.blurb}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-base font-semibold text-text">
                    {option.fee}
                  </span>
                  <span
                    className={cn(
                      "flex h-5 w-5 items-center justify-center rounded-full border",
                      selected
                        ? "border-violet bg-violet text-white"
                        : "border-border",
                    )}
                    aria-hidden
                  >
                    {selected && <Check className="h-3 w-3" />}
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        {!paymentConfigured && (
          <p className="mt-4 text-sm text-down">
            Paid onboarding isn't configured for this environment yet.
          </p>
        )}

        {(getUsdc.error || pay.error) && (
          <p role="alert" className="mt-4 text-sm text-down">
            {errorText(
              getUsdc.error ?? pay.error,
              "Something went wrong. Please try again.",
            )}
          </p>
        )}

        <div className="mt-6 flex flex-col gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={onGetUsdc}
            disabled={busy || provisioning || !paymentConfigured}
            className="h-12 w-full rounded-full text-sm"
          >
            {getUsdc.isPending ? (
              <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
            ) : funded ? (
              "Get more test USDC"
            ) : (
              "Get test USDC"
            )}
          </Button>

          <Button
            type="button"
            variant="primary"
            onClick={onPay}
            disabled={busy || provisioning || !paymentConfigured}
            className="h-14 w-full rounded-full text-base"
          >
            {pay.isPending ? (
              <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
            ) : (
              "Pay & start evaluation"
            )}
          </Button>
        </div>

        <p
          role="status"
          aria-live="polite"
          className="mt-3 min-h-5 text-center text-xs text-text-muted"
        >
          {provisioning
            ? "Preparing your wallet…"
            : getUsdc.isPending
              ? "Minting test USDC…"
              : pay.isPending
                ? "Confirming payment and opening your account…"
                : ""}
        </p>

        <div className="mt-6 border-t border-border pt-5">
          {!inviteOpen ? (
            <button
              type="button"
              onClick={() => setInviteOpen(true)}
              className="text-sm text-text-muted underline-offset-2 transition-colors hover:text-text hover:underline"
            >
              Have an invite code?
            </button>
          ) : (
            <form onSubmit={onRedeem} className="flex flex-col gap-3">
              <label
                htmlFor="invite-code"
                className="text-sm font-medium text-text"
              >
                Invite code
              </label>
              <input
                id="invite-code"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value)}
                autoComplete="off"
                spellCheck={false}
                placeholder="Enter your code"
                disabled={redeem.isPending}
                className="h-12 w-full rounded-xl border border-border bg-surface px-4 text-sm text-text outline-none focus:border-violet"
              />
              {redeem.error && (
                <p role="alert" className="text-sm text-down">
                  {errorText(redeem.error, "That invite code isn't valid.")}
                </p>
              )}
              <p className="text-xs text-text-muted">
                Invite codes open a Starter account, on us.
              </p>
              <Button
                type="submit"
                variant="primary"
                disabled={!inviteCode.trim() || redeem.isPending || provisioning}
                className="h-12 w-full rounded-full text-sm"
              >
                {redeem.isPending ? (
                  <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
                ) : (
                  "Redeem invite"
                )}
              </Button>
            </form>
          )}
        </div>

        <p className="mt-6 text-center text-sm">
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
