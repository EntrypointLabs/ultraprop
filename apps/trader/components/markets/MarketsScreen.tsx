"use client";

import { Search, Star, Wifi } from "lucide-react";
import * as React from "react";
import { ActiveEvalCard } from "@/components/markets/ActiveEvalCard";
import { GenesisBanner } from "@/components/markets/GenesisBanner";
import { MarketsTable } from "@/components/markets/MarketsTable";
import { StartEvalHero } from "@/components/markets/StartEvalHero";
import {
  Card,
  CardHeader,
  CardLabel,
  ConnectionDot,
  Input,
  SegmentedControl,
  Toggle,
} from "@/components/ui";
import { DEMO_VAULT_ID } from "@/lib/mock/fixtures";
import { useConnection, useVault } from "@/lib/mock/hooks";
import type { Symbol } from "@/lib/mock/types";
import { cn } from "@/lib/utils";

type Category = "all" | "crypto";

export function MarketsScreen() {
  const vault = useVault(DEMO_VAULT_ID);
  const connStatus = useConnection();
  const hasActiveEval = vault.status === "active";

  const [searchQuery, setSearchQuery] = React.useState("");
  const [category, setCategory] = React.useState<Category>("all");
  const [showFavoritesOnly, setShowFavoritesOnly] = React.useState(false);
  const [showLiveOnly, setShowLiveOnly] = React.useState(false);
  const [favorites, setFavorites] = React.useState<Set<Symbol>>(
    new Set(["BTC"]),
  );

  function toggleFav(sym: Symbol) {
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(sym)) next.delete(sym);
      else next.add(sym);
      return next;
    });
  }

  return (
    <div className="mx-auto max-w-7xl px-4 pb-16 pt-6 sm:px-6">
      {/* ---- Hero section ---- */}
      <div className="mb-6 flex flex-col gap-4">
        {/* Genesis cohort banner — always shown, warm amber */}
        <GenesisBanner />

        {/* Active eval card OR start hero */}
        {hasActiveEval ? <ActiveEvalCard /> : <StartEvalHero />}
      </div>

      {/* ---- Markets table card ---- */}
      <Card>
        <CardHeader className="flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex items-center gap-2">
            <CardLabel>Markets</CardLabel>
            <ConnectionDot status={connStatus} showLabel={false} />
            <span className="text-xs text-text-muted capitalize">
              {connStatus}
            </span>
          </div>

          <div className="flex flex-1 flex-wrap items-center gap-2 sm:justify-end">
            {/* Category filter */}
            <SegmentedControl<Category>
              size="sm"
              options={[
                { value: "all", label: "All" },
                { value: "crypto", label: "Crypto" },
              ]}
              value={category}
              onValueChange={setCategory}
            />

            {/* Favorites toggle */}
            <Toggle
              checked={showFavoritesOnly}
              onCheckedChange={setShowFavoritesOnly}
              label={
                <span className="flex items-center gap-1 text-xs">
                  <Star className="h-3 w-3" />
                  Favorites
                </span>
              }
            />

            {/* Live feed toggle */}
            <Toggle
              checked={showLiveOnly}
              onCheckedChange={setShowLiveOnly}
              label={
                <span className="flex items-center gap-1 text-xs">
                  <Wifi className="h-3 w-3" />
                  Live
                </span>
              }
            />

            {/* Search */}
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-faint" />
              <Input
                placeholder="Search assets…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-8 w-40 pl-8 text-xs sm:w-48"
              />
            </div>
          </div>
        </CardHeader>

        <MarketsTable
          searchQuery={searchQuery}
          showFavoritesOnly={showFavoritesOnly}
          favorites={favorites}
          onToggleFav={toggleFav}
        />

        {/* Footer legend */}
        <div className="flex items-center justify-between border-t border-border-soft px-4 py-2.5 text-xs text-text-faint">
          <span>v1 · BTC / ETH / SOL spot only</span>
          <span>+2 bps house tilt on all fills</span>
        </div>
      </Card>

      {/* ---- Tier ladder teaser ---- */}
      <TierLadderTeaser />
    </div>
  );
}

/** Compact tier-ladder below the table — quick reference for new users */
function TierLadderTeaser() {
  const tiers = [
    {
      name: "Starter",
      leverage: "10X",
      target: "8%",
      maxDd: "10%",
      daily: "5%",
      size: "$10,000",
      locked: false,
    },
    {
      name: "Basic",
      leverage: "8X",
      target: "8%",
      maxDd: "8%",
      daily: "5%",
      size: "$25,000",
      locked: true,
    },
    {
      name: "Pro",
      leverage: "8X",
      target: "10%",
      maxDd: "8%",
      daily: "5%",
      size: "$50,000",
      locked: true,
    },
  ];

  return (
    <div className="mt-6">
      <div className="mb-3 flex items-center gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-text-muted">
          Tier ladder
        </span>
        <div className="h-px flex-1 bg-border-soft" />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {tiers.map((tier, i) => (
          <TierCard key={tier.name} tier={tier} index={i} />
        ))}
      </div>
    </div>
  );
}

function TierCard({
  tier,
  index,
}: {
  tier: {
    name: string;
    leverage: string;
    target: string;
    maxDd: string;
    daily: string;
    size: string;
    locked: boolean;
  };
  index: number;
}) {
  const isFirst = index === 0;

  return (
    <Card
      className={cn(
        "relative overflow-hidden transition-colors",
        tier.locked && "opacity-60",
        isFirst && "border-brand/30",
      )}
    >
      {isFirst && (
        <div className="absolute inset-y-0 left-0 w-0.5 rounded-l-[var(--radius)] bg-brand" />
      )}
      <div className="flex items-start justify-between p-4">
        <div>
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-text">{tier.name}</span>
            {tier.locked && <span className="text-xs text-text-faint">🔒</span>}
          </div>
          <div className="tabular mt-0.5 text-lg font-bold text-text">
            {tier.size}
          </div>
          <div className="mt-0.5 text-xs text-text-muted">Account size</div>
        </div>
        <span className="tabular rounded-sm bg-brand px-2 py-0.5 text-xs font-bold text-brand-ink">
          {tier.leverage}
        </span>
      </div>

      <div className="border-t border-border-soft px-4 pb-4 pt-3">
        <div className="grid grid-cols-3 gap-2 text-center">
          <div>
            <div className="tabular text-sm font-semibold text-up">
              {tier.target}
            </div>
            <div className="text-xs text-text-faint">Target</div>
          </div>
          <div>
            <div className="tabular text-sm font-semibold text-down">
              {tier.maxDd}
            </div>
            <div className="text-xs text-text-faint">Max DD</div>
          </div>
          <div>
            <div className="tabular text-sm font-semibold text-warn">
              {tier.daily}
            </div>
            <div className="text-xs text-text-faint">Daily</div>
          </div>
        </div>

        {!tier.locked && (
          <a
            href="/start"
            className={cn(
              "mt-3 flex h-8 w-full items-center justify-center rounded-[var(--radius-sm)]",
              "bg-brand text-xs font-semibold text-brand-ink transition-[filter] hover:brightness-95",
            )}
          >
            Start Starter evaluation
          </a>
        )}
        {tier.locked && (
          <div className="mt-3 flex h-8 w-full items-center justify-center rounded-[var(--radius-sm)] bg-surface-2 text-xs text-text-faint">
            Pass {index === 1 ? "Starter" : "Basic"} to unlock
          </div>
        )}
      </div>
    </Card>
  );
}
