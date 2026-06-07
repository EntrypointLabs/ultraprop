"use client";

import { Check, Share2 } from "lucide-react";
import * as React from "react";
import { Button } from "@/components/ui";
import type { SbtState, VaultState } from "@/lib/mock/types";
import { cn } from "@/lib/utils";

export interface ShareCardProps {
  vault: VaultState;
  sbt: SbtState;
  className?: string;
}

const LEVEL_NAMES = ["", "Starter", "Basic", "Pro"] as const;

export function ShareCard({ vault, sbt, className }: ShareCardProps) {
  const [copied, setCopied] = React.useState(false);

  const returnPct =
    ((vault.equity - vault.startingEquity) / vault.startingEquity) * 100;
  const tierName = vault.tier.name;
  const nextTier =
    vault.tier.id === "starter"
      ? "Basic"
      : vault.tier.id === "basic"
        ? "Pro"
        : null;
  const levelName = LEVEL_NAMES[sbt.level] ?? tierName;

  const shareText = [
    `Passed ${tierName} evaluation on Entrypoint.`,
    `Return: +${returnPct.toFixed(2)}%  |  Credential: ${levelName} (v1 Genesis)`,
    nextTier ? `Next: ${nextTier} evaluation.` : "Max tier achieved.",
    "",
    "Institutional prop firm evaluation — closed beta.",
    "https://entrypoint.trade",
  ].join("\n");

  const handleCopy = () => {
    navigator.clipboard.writeText(shareText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  };

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      {/* Card preview area — styled like an X/Farcaster share card */}
      <div
        className="rounded-[var(--radius-lg)] border border-border bg-surface-2 overflow-hidden select-none"
        aria-label="Share preview card"
      >
        {/* pixel banner header */}
        <div className="pixel-banner h-10 flex items-center px-4 gap-2">
          <span className="text-brand-ink font-bold text-sm tracking-wide">
            ENTRYPOINT
          </span>
          <span className="ml-auto text-brand-ink/70 text-xs font-mono tabular">
            v1 Genesis
          </span>
        </div>

        <div className="px-4 py-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-wide text-text-muted mb-1">
                Evaluation result
              </p>
              <h3 className="text-2xl font-bold text-text tracking-tight">
                {tierName} <span className="text-up">Passed</span>
              </h3>
            </div>
            <div className="rounded-full border border-up/30 bg-up/15 px-3 py-1.5 text-up text-sm font-semibold tabular">
              +{returnPct.toFixed(2)}%
            </div>
          </div>

          <div className="mt-3 flex items-center gap-3">
            <div className="rounded-sm border border-violet/30 bg-violet/10 px-2 py-1">
              <span className="text-xs uppercase tracking-wide text-violet font-semibold">
                Credential Level {sbt.level} — {levelName}
              </span>
            </div>
            <div className="rounded-sm border border-border bg-surface px-2 py-1">
              <span className="text-xs text-text-muted">cohort</span>
              <span className="ml-1 text-xs font-semibold text-text">
                {sbt.cohort}
              </span>
            </div>
          </div>

          <p className="mt-3 text-xs text-text-faint">
            Verifiable, non-transferable proof of trading skill · entrypoint.trade
          </p>
        </div>
      </div>

      {/* Copy share text button */}
      <Button
        variant="outline"
        size="sm"
        onClick={handleCopy}
        className="self-start gap-2"
        aria-label="Copy share text to clipboard"
      >
        {copied ? (
          <>
            <Check className="h-3.5 w-3.5 text-up" />
            <span className="text-up">Copied</span>
          </>
        ) : (
          <>
            <Share2 className="h-3.5 w-3.5" />
            Share result
          </>
        )}
      </Button>
    </div>
  );
}
