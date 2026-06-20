"use client";

import { Loader2 } from "lucide-react";
import type * as React from "react";
import { Redirect } from "@/components/Redirect";
import { userVaultId } from "@/lib/auth";
import { DEMO_VAULT_ID } from "@/lib/mock/fixtures";
import { useAccountSetup } from "@/lib/sui/useTradingAccount";

function CockpitLoader() {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center gap-3 text-text-muted">
      <Loader2 className="h-6 w-6 animate-spin" aria-hidden />
      <p className="text-sm">Loading your cockpit…</p>
    </div>
  );
}

/**
 * Authorization gate for the evaluation cockpit. The cockpit is a protected
 * surface — only a signed-in trader with an on-chain account may enter, and only
 * their OWN vault. The shared demo vault stays open read-only.
 *
 * The redirect decision is deferred until the auth/account picture has fully
 * resolved: a refresh holds on the loader in place and never bounces the trader
 * off the page they're on. We only route away once we KNOW access is missing —
 *   not signed in              → /login
 *   signed in, no account      → /onboarding   (pay or redeem opens the account)
 *   signed in, someone else's  → their own cockpit
 */
export function EvaluationGuard({
  vaultId,
  children,
}: {
  vaultId: string;
  children: React.ReactNode;
}) {
  const { ready, authenticated, checking, needsSetup, hasAccount, suiAddress } =
    useAccountSetup();

  // The shared demo vault is public — anyone may view it read-only.
  if (vaultId === DEMO_VAULT_ID) return <>{children}</>;

  // Hold until we actually know the trader's status. This is what keeps a
  // refresh from deciding mid-hydration and routing the trader away.
  if (!ready || checking) return <CockpitLoader />;

  if (!authenticated) return <Redirect href="/login" />;

  // Authenticated but no on-chain account: not yet authorized for the cockpit.
  // Onboarding is where the account is actually opened.
  if (needsSetup) return <Redirect href="/onboarding" />;

  // Signed in with an account, but this isn't their vault → send them to theirs.
  if (hasAccount && suiAddress && vaultId !== userVaultId(suiAddress)) {
    return <Redirect href={`/evaluation/${userVaultId(suiAddress)}`} />;
  }

  return <>{children}</>;
}
