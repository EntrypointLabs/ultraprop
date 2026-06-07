"use client";

import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui";
import { useDivergenceHalt, useSession } from "@/lib/mock/hooks";

/**
 * Client island for the start page.
 * Renders the divergence-halt warning and the sign-in prompt if needed.
 */
export function StartPageClient() {
  const { halted } = useDivergenceHalt();
  const { session, signIn, hydrated } = useSession();

  const isSignedIn = Boolean(session.address);

  if (!hydrated) return null;

  return (
    <div className="mb-6 flex flex-col gap-3">
      {/* Sign-in prompt */}
      {!isSignedIn && (
        <div className="flex items-center justify-between gap-4 rounded-[var(--radius)] border border-violet/30 bg-violet/8 px-5 py-3">
          <div>
            <p className="text-sm font-medium text-text">
              Sign in to start
            </p>
            <p className="text-xs text-text-muted mt-0.5">
              Sign in to check your allowlist status and begin an evaluation.
            </p>
          </div>
          <Button
            variant="primary"
            size="sm"
            className="shrink-0"
            onClick={signIn}
          >
            Sign in
          </Button>
        </div>
      )}

      {/* Divergence halt notice */}
      {halted && (
        <div className="flex items-start gap-3 rounded-[var(--radius)] border border-warn/30 bg-warn/8 px-5 py-3">
          <AlertTriangle className="h-4 w-4 text-warn shrink-0 mt-0.5" />
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
