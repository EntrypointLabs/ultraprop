"use client";

import { Badge, Button, Card } from "@/components/ui";
import { accountHandle } from "@/lib/identity";
import { DEMO_WALLET } from "@/lib/mock/fixtures";
import { useSbt } from "@/lib/mock/hooks";
import { suiObjectUrl } from "@/lib/sui/explorer";

interface ProofPillar {
  icon: string;
  title: string;
  body: string;
}

const PROOF_PILLARS: ProofPillar[] = [
  {
    icon: "⬡",
    title: "Live Market Prices",
    body: "Every trade is evaluated against live market prices at the moment of submission — the same prices that would move real capital. There is no delayed or synthetic feed.",
  },
  {
    icon: "⛓",
    title: "Automatic Rule Enforcement",
    body: "Drawdown limits, daily loss caps, profit targets, and trade-count budgets are enforced by the evaluation contract. No backend override is possible. Rules cannot be relaxed retroactively.",
  },
  {
    icon: "◈",
    title: "Non-Transferable Credential",
    body: "The credential is issued once per trader and cannot be transferred, listed, or replicated. It is permanently bound to the account that earned it.",
  },
  {
    icon: "✦",
    title: "Issued Once Per Trader",
    body: "A single account can hold exactly one credential. There is no farming mechanism — level-ups require passing successively harder evaluation tiers on the same account.",
  },
  {
    icon: "◎",
    title: "Publicly Verifiable",
    body: "Every pass event and every level-up is a permanently recorded transaction. Any third party can independently verify the reference, owner, and history.",
  },
  {
    icon: "▣",
    title: "Calibrated Slippage Model",
    body: "A +2 bps house tilt is applied against the trader on every fill — disclosed pre-submit, non-negotiable, identical for all participants. The model is deterministic and reproducible.",
  },
];

export function WhatItProves() {
  const sbt = useSbt(DEMO_WALLET);
  // A live "Verify" link only for a real on-chain object id; otherwise the
  // example record shows its reference as plain text (no dead proof link).
  const verifyUrl = suiObjectUrl(sbt.objectId);

  return (
    <section className="space-y-6">
      {/* Section header */}
      <div className="space-y-2">
        <Badge variant="tier" className="text-xs">
          Genesis Credential
        </Badge>
        <h2 className="text-2xl font-bold tracking-tight text-text sm:text-3xl">
          What the v1 Genesis credential credibly proves
        </h2>
        <p className="max-w-2xl text-sm leading-relaxed text-text-muted">
          The credential is not a membership card or a badge of participation.
          It is a verifiable record that a specific trader demonstrated
          profitable discipline against real market conditions, within rules
          that the evaluation contract enforced and that cannot be changed after
          the fact.
        </p>
      </div>

      {/* Proof pillars grid */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {PROOF_PILLARS.map((pillar) => (
          <Card key={pillar.title} className="flex flex-col gap-3 p-4">
            <div className="flex items-center gap-3">
              <span
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-sm bg-violet/10 text-lg text-violet"
                aria-hidden
              >
                {pillar.icon}
              </span>
              <h3 className="text-sm font-semibold text-text">
                {pillar.title}
              </h3>
            </div>
            <p className="text-xs leading-relaxed text-text-muted">
              {pillar.body}
            </p>
          </Card>
        ))}
      </div>

      {/* Sample SBT card */}
      <div className="rounded-lg border border-border bg-surface p-5 sm:p-6">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <Badge variant="genesis">v1 Genesis</Badge>
            <h3 className="mt-2 text-base font-semibold text-text">
              Example credential record
            </h3>
            <p className="text-xs text-text-muted">
              Account:{" "}
              <code className="tabular rounded bg-surface-2 px-1.5 py-0.5 text-xs text-text-faint">
                {accountHandle(sbt.owner)}
              </code>
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:items-end">
            <div className="flex items-center gap-2">
              <span className="text-xs text-text-muted">Credential Level</span>
              <Badge variant="leverage">{sbt.level}</Badge>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {sbt.passedTiers.map((t) => (
                <Badge key={t} variant="tier">
                  {t} ✓
                </Badge>
              ))}
            </div>
            <div className="text-xs text-text-muted">
              Cohort:{" "}
              <span className="font-medium text-warn">{sbt.cohort}</span>
            </div>
          </div>
        </div>

        {sbt.objectId && (
          <div className="mt-4 flex flex-col gap-2 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
            <code className="tabular break-all text-xs text-text-faint">
              Reference: {sbt.objectId}
            </code>
            {verifyUrl && (
              <Button
                variant="ghost"
                size="sm"
                className="shrink-0"
                aria-label="Verify"
                onClick={() =>
                  window.open(verifyUrl, "_blank", "noopener,noreferrer")
                }
              >
                Verify ↗
              </Button>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
