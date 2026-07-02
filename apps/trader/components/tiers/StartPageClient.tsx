"use client";

import { AlertTriangle } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";
import { useDivergenceHalt } from "@/lib/mock/hooks";
import { useAccountSetup } from "@/lib/sui/useTradingAccount";

/**
 * Client island for the start page.
 * Renders the divergence-halt warning and, when the trader isn't authenticated
 * with Privy, a prompt to sign in before starting an evaluation.
 */
export function StartPageClient() {
  const router = useRouter();
  const { halted } = useDivergenceHalt();
  const { ready, authenticated } = useAccountSetup();

  if (!ready) return null;

  return (
    <div className="mb-6 flex flex-col gap-3">
      {/* Sign-in prompt */}
      {!authenticated && (
        <div className="flex items-center justify-between gap-4 rounded-[var(--radius)] border border-violet/30 bg-violet/8 px-5 py-3">
          <div>
            <p className="text-sm font-medium text-text">Sign in to start</p>
            <p className="text-xs text-text-muted mt-0.5">
              Sign in to open or continue your evaluation account.
            </p>
          </div>
          <Button
            variant="primary"
            size="sm"
            className="shrink-0"
            onClick={() => router.push("/login")}
          >
            Sign in
          </Button>
        </div>
      )}

      {/* Divergence halt notice */}
      {halted && (
        <div className="flex items-start gap-3 rounded-[var(--radius)] border border-warn/30 bg-warn/8 px-5 py-3">
          <AlertTriangle className="h-4 w-4 text-warn shrink-0 mt-0.5" aria-hidden="true" />
          <div>
            <p className="text-sm font-medium text-warn">Trading paused</p>
            <p className="text-xs text-text-muted mt-0.5">
              Market data feed interrupted. Evaluations cannot be opened until the halt
              clears. Resumes automatically.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
