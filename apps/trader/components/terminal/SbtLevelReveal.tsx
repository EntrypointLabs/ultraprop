"use client";

import * as React from "react";
import { Badge } from "@/components/ui";
import type { SbtState } from "@/lib/mock/types";
import { cn } from "@/lib/utils";

export interface SbtLevelRevealProps {
  sbt: SbtState;
  prevLevel: number;
  className?: string;
}

const LEVEL_LABELS = ["", "Starter", "Basic", "Pro"] as const;

const LEVEL_COLORS: Record<
  number,
  { ring: string; glow: string; label: string }
> = {
  1: {
    ring: "border-brand",
    glow: "shadow-[0_0_32px_rgba(106,106,224,0.25)]",
    label: "text-brand",
  },
  2: {
    ring: "border-violet",
    glow: "shadow-[0_0_32px_rgba(109,93,252,0.3)]",
    label: "text-violet",
  },
  3: {
    ring: "border-up",
    glow: "shadow-[0_0_32px_rgba(52,211,153,0.3)]",
    label: "text-up",
  },
};

const HEX_LEVELS = ["", "I", "II", "III"] as const;

export function SbtLevelReveal({
  sbt,
  prevLevel,
  className,
}: SbtLevelRevealProps) {
  const [revealed, setRevealed] = React.useState(false);
  const newLevel = sbt.level;
  const colors = LEVEL_COLORS[newLevel] ?? LEVEL_COLORS[1];
  const levelName = LEVEL_LABELS[newLevel] ?? "Unknown";

  React.useEffect(() => {
    const t = setTimeout(() => setRevealed(true), 300);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className={cn("flex flex-col items-center gap-5", className)}>
      {/* SBT visual */}
      <div
        className={cn(
          "relative transition-all duration-700 ease-out",
          revealed ? "opacity-100 scale-100" : "opacity-0 scale-75",
        )}
      >
        {/* Outer glow ring */}
        <div
          className={cn(
            "rounded-full border-2 p-1 transition-all duration-700",
            colors.ring,
            colors.glow,
          )}
        >
          {/* SBT hexagonal badge */}
          <div
            className={cn(
              "relative flex items-center justify-center rounded-full bg-surface-2 border border-border",
            )}
            style={{ width: 120, height: 120 }}
          >
            {/* Pixel checkerboard ring via CSS */}
            <svg
              width={120}
              height={120}
              viewBox="0 0 120 120"
              className="absolute inset-0"
              aria-hidden
            >
              {/* Background circle with subtle pattern overlay */}
              <circle
                cx="60"
                cy="60"
                r="58"
                fill="none"
                stroke="var(--color-border)"
                strokeWidth="1"
              />
            </svg>

            <div className="relative z-10 flex flex-col items-center gap-1">
              <span
                className={cn("font-bold tabular select-none", colors.label)}
                style={{ fontSize: 42, lineHeight: 1 }}
              >
                {HEX_LEVELS[newLevel] ?? newLevel}
              </span>
              <span className="text-xs font-semibold uppercase tracking-widest text-text-muted">
                Credential
              </span>
            </div>

            {/* Level-up shimmer overlay */}
            {revealed && prevLevel < newLevel && (
              <div
                className="absolute inset-0 rounded-full pointer-events-none"
                style={{
                  background:
                    "radial-gradient(ellipse at 50% 30%, rgba(212,242,62,0.15) 0%, transparent 70%)",
                  animation: "pulse 2s ease-in-out infinite",
                }}
              />
            )}
          </div>
        </div>

        {/* Level-up indicator badge */}
        {prevLevel < newLevel && (
          <div
            className={cn(
              "absolute -top-2 -right-2 transition-all duration-500",
              revealed ? "opacity-100 scale-100" : "opacity-0 scale-50",
            )}
            style={{ transitionDelay: "400ms" }}
          >
            <span className="inline-flex items-center gap-0.5 rounded-sm bg-brand px-2 py-0.5 text-xs font-bold text-brand-ink uppercase tracking-wide">
              ↑ Levelled up
            </span>
          </div>
        )}
      </div>

      {/* Text reveal */}
      <div
        className={cn(
          "flex flex-col items-center gap-2 text-center transition-all duration-500",
          revealed ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3",
        )}
        style={{ transitionDelay: "250ms" }}
      >
        <h2 className="text-xl font-bold text-text">
          v1 Genesis credential —{" "}
          <span className={colors.label}>Level {newLevel}</span>
        </h2>
        <p className="text-sm text-text-muted max-w-xs">
          Your <strong className="text-text">{levelName}</strong> pass is
          permanently recorded as verifiable, non-transferable proof of trading
          skill.
        </p>

        {sbt.objectId && (
          <a
            href={`https://suiexplorer.com/object/${sbt.objectId}?network=mainnet`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-violet hover:text-violet-hover hover:underline"
          >
            Verify ↗
          </a>
        )}

        <div className="flex flex-wrap items-center justify-center gap-2 mt-1">
          {sbt.passedTiers.map((t) => (
            <Badge key={t} variant="tier">
              {t} passed
            </Badge>
          ))}
        </div>
      </div>
    </div>
  );
}
