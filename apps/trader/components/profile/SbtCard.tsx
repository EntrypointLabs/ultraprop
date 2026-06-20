"use client";

import { ExternalLink, Shield } from "lucide-react";
import {
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardLabel,
} from "@/components/ui";
import type { SbtLevel, SbtState } from "@/lib/mock/types";
import { suiObjectUrl } from "@/lib/sui/explorer";
import { formatUsd } from "@/lib/utils";

interface SbtCardProps {
  sbt: SbtState;
  shadowPnl: number;
  passes: number;
}

const LEVEL_META: Record<
  SbtLevel,
  {
    label: string;
    color: string;
    bgClass: string;
    borderClass: string;
    glowClass: string;
  }
> = {
  0: {
    label: "Unranked",
    color: "var(--text-faint)",
    bgClass: "bg-surface-3",
    borderClass: "border-border",
    glowClass: "",
  },
  1: {
    label: "Starter",
    color: "var(--up)",
    bgClass: "bg-up/10",
    borderClass: "border-up/30",
    glowClass: "",
  },
  2: {
    label: "Basic",
    color: "var(--violet)",
    bgClass: "bg-violet/10",
    borderClass: "border-violet/30",
    glowClass: "",
  },
  3: {
    label: "Pro",
    color: "var(--brand)",
    bgClass: "bg-brand/10",
    borderClass: "border-brand/40",
    glowClass: "",
  },
};

function SbtBadgeGraphic({ level }: { level: SbtLevel }) {
  const meta = LEVEL_META[level];
  const size = 80;
  const r = 34;
  const cx = 40;
  const cy = 40;

  return (
    <div className="relative shrink-0">
      <svg
        width={size}
        height={size}
        viewBox="0 0 80 80"
        aria-label={`SBT Level ${level} badge`}
      >
        {/* Outer ring */}
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke={meta.color}
          strokeWidth={2}
          strokeOpacity={0.35}
          strokeDasharray="4 3"
        />
        {/* Inner fill */}
        <circle
          cx={cx}
          cy={cy}
          r={r - 6}
          fill={meta.color}
          fillOpacity={0.12}
        />
        {/* Shield icon center */}
        <text
          x={cx}
          y={cy + 5}
          textAnchor="middle"
          fontSize="22"
          fill={meta.color}
          style={{ fontFamily: "monospace" }}
        >
          {level === 0 ? "○" : level === 1 ? "◆" : level === 2 ? "◈" : "★"}
        </text>
      </svg>
      {/* Level badge chip */}
      <span
        className="absolute -bottom-1 -right-1 tabular rounded-sm px-1 py-0.5 text-xs font-semibold leading-none"
        style={{
          backgroundColor: meta.color,
          color: "var(--bg)",
        }}
      >
        L{level}
      </span>
    </div>
  );
}

function SuiObjectLink({ objectId }: { objectId: string }) {
  // A real on-chain credential gets a live "Verify" link; a mock/demo object id
  // (not 0x-hex) is shown as plain text so we never present a dead proof link.
  const url = suiObjectUrl(objectId);
  if (!url) {
    return (
      <code className="tabular break-all text-xs text-text-faint">
        {objectId}
      </code>
    );
  }
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-xs text-text-muted hover:text-violet transition-colors"
      aria-label="Verify credential on the public ledger"
    >
      <span>Verify</span>
      <ExternalLink size={11} />
    </a>
  );
}

const TIER_ROW = [
  { id: "starter" as const, label: "Starter" },
  { id: "basic" as const, label: "Basic" },
  { id: "pro" as const, label: "Pro" },
];

export function SbtCard({ sbt, shadowPnl, passes }: SbtCardProps) {
  const meta = LEVEL_META[sbt.level];
  const lastActive = sbt.lastLevelUpAt
    ? new Date(sbt.lastLevelUpAt).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "—";

  return (
    <Card className={`border ${meta.borderClass}`}>
      <CardHeader>
        <CardLabel className="flex items-center gap-2">
          <Shield size={12} />
          v1 Genesis credential
        </CardLabel>
        <Badge variant="genesis">{sbt.cohort}</Badge>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-6">
          {/* Badge graphic */}
          <div className="flex items-center gap-4 sm:flex-col sm:items-center sm:gap-2">
            <SbtBadgeGraphic level={sbt.level} />
            <div className="text-center">
              <div
                className="text-xs font-semibold uppercase tracking-wide"
                style={{ color: meta.color }}
              >
                {meta.label}
              </div>
              <div className="text-xs text-text-faint mt-0.5">
                Level {sbt.level}
              </div>
            </div>
          </div>

          {/* SBT data grid */}
          <div className="flex-1 grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
            <div>
              <div className="text-xs uppercase tracking-wide text-text-muted">
                Highest Tier
              </div>
              <div className="tabular text-sm font-semibold text-text mt-0.5">
                {sbt.passedTiers.length > 0
                  ? sbt.passedTiers[sbt.passedTiers.length - 1]
                  : "—"}
              </div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-text-muted">
                Passes
              </div>
              <div className="tabular text-sm font-semibold text-up mt-0.5">
                {passes}
              </div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-text-muted">
                Simulated P&L
              </div>
              <div
                className={`tabular text-sm font-semibold mt-0.5 ${shadowPnl >= 0 ? "text-up" : "text-down"}`}
              >
                {formatUsd(shadowPnl, { sign: true })}
              </div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-text-muted">
                Last Active
              </div>
              <div className="tabular text-sm text-text-muted mt-0.5">
                {lastActive}
              </div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-text-muted">
                Tiers Passed
              </div>
              <div className="flex items-center gap-1 mt-0.5">
                {TIER_ROW.map((t) => {
                  const earned = sbt.passedTiers.includes(t.label);
                  return (
                    <span
                      key={t.id}
                      className={`tabular text-xs rounded-sm px-1.5 py-0.5 font-medium ${
                        earned
                          ? "bg-violet/20 text-on-accent"
                          : "bg-surface-3 text-text-faint"
                      }`}
                    >
                      {t.label}
                    </span>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Object ID link */}
        {sbt.objectId && (
          <div className="mt-4 pt-3 border-t border-border-soft flex items-center gap-2">
            <span className="text-xs text-text-faint uppercase tracking-wide">
              Reference
            </span>
            <SuiObjectLink objectId={sbt.objectId} />
            <span className="text-xs text-text-faint ml-auto">
              Non-transferable · Independently verifiable
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
