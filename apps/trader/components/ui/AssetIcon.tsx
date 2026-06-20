"use client";

import type * as React from "react";
import { useState } from "react";
import { Tooltip } from "@/components/ui/Tooltip";
import { coinOf } from "@/lib/mock/markets";
import type { MarketId } from "@/lib/mock/types";
import { cn } from "@/lib/utils";

export interface AssetIconProps {
  symbol: MarketId;
  size?: number;
  className?: string;
  /** Overlay a small venue badge (e.g. Hyperliquid) on the bottom-right. */
  venue?: boolean;
}

/** Hand-tuned brand chips, shown only when the live logo fails to load. */
const TONE: Record<string, { bg: string; fg: string; glyph: string }> = {
  BTC: { bg: "#F7931A", fg: "#0A0A0C", glyph: "₿" },
  ETH: { bg: "#627EEA", fg: "#FFFFFF", glyph: "Ξ" },
  SOL: { bg: "#14F195", fg: "#0A0A0C", glyph: "◎" },
};

/**
 * The venue's bottom-right badge: the venue's brand mark on its brand backdrop,
 * so a row reads "ETH" + a Hyperliquid badge instead of the noisier
 * "hyperliquid:ETH". Keyed by the venue prefix of a `MarketId`.
 */
const VENUE_BADGE: Record<string, { label: string; bg: string; mark: string }> =
  {
    hyperliquid: {
      label: "Hyperliquid",
      bg: "#0b1411",
      // Hyperliquid's mint logomark (their own HYPE coin art).
      mark: "M144 71.6991C144 119.306 114.866 134.582 99.5156 120.98C86.8804 109.889 83.1211 86.4521 64.116 84.0456C39.9942 81.0113 37.9057 113.133 22.0334 113.133C3.5504 113.133 0 86.2428 0 72.4315C0 58.3063 3.96809 39.0542 19.736 39.0542C38.1146 39.0542 39.1588 66.5722 62.132 65.1073C85.0007 63.5379 85.4184 34.8689 100.247 22.6271C113.195 12.0593 144 23.4641 144 71.6991Z",
    },
  };

/** Deterministic hue from the ticker so any future market renders a stable chip. */
function hashedHue(coin: string): number {
  let h = 0;
  for (let i = 0; i < coin.length; i++) {
    h = (h * 31 + coin.charCodeAt(i)) >>> 0;
  }
  return h % 360;
}

/** Stable initials fallback (first two non-numeric chars, uppercased). */
function initials(coin: string): string {
  const letters = coin.replace(/[^a-z]/gi, "");
  return (letters || coin).slice(0, 2).toUpperCase();
}

/**
 * Hyperliquid serves a per-coin SVG at this path. The "1000×" perps (kPEPE,
 * kBONK, …) have no art of their own, so they reuse the base coin's icon.
 */
function iconUrl(coin: string): string {
  const base = /^k[A-Z]/.test(coin) ? coin.slice(1) : coin;
  return `https://app.hyperliquid.xyz/coins/${base}.svg`;
}

function VenueBadge({ venue, iconSize }: { venue: string; iconSize: number }) {
  const cfg = VENUE_BADGE[venue];
  if (!cfg) return null;
  const badge = Math.max(8, Math.round(iconSize * 0.45));
  return (
    <span
      className="absolute -bottom-0.5 -right-0.5 inline-flex items-center justify-center rounded-full ring-1 ring-surface"
      style={{ width: badge, height: badge, backgroundColor: cfg.bg }}
      aria-label={cfg.label}
    >
      <svg
        viewBox="0 0 144 144"
        fill="none"
        className="h-[80%] w-[80%]"
        aria-hidden="true"
      >
        <path d={cfg.mark} fill="#97FCE4" />
      </svg>
    </span>
  );
}

export function AssetIcon({
  symbol,
  size = 20,
  className,
  venue = false,
}: AssetIconProps) {
  const coin = coinOf(symbol);
  const [failedCoin, setFailedCoin] = useState<string | null>(null);

  const venueId = venue ? symbol.split(":")[0] : null;
  const showVenue = Boolean(
    venueId && venueId !== symbol && VENUE_BADGE[venueId],
  );

  let body: React.ReactNode;
  if (failedCoin === coin) {
    const known = TONE[coin];
    const bg = known?.bg ?? `hsl(${hashedHue(coin)} 55% 42%)`;
    const fg = known?.fg ?? "#FFFFFF";
    const glyph = known?.glyph ?? initials(coin);
    body = (
      <span
        className="inline-flex h-full w-full items-center justify-center rounded-full font-semibold"
        style={{
          backgroundColor: bg,
          color: fg,
          fontSize: known ? size * 0.55 : size * 0.4,
          lineHeight: 1,
        }}
        aria-label={coin}
      >
        {glyph}
      </span>
    );
  } else {
    body = (
      <span className="inline-flex h-full w-full items-center justify-center overflow-hidden rounded-full bg-white">
        <img
          src={iconUrl(coin)}
          alt={coin}
          width={size}
          height={size}
          loading="lazy"
          decoding="async"
          draggable={false}
          className="h-full w-full object-cover"
          ref={(img) => {
            if (img && img.complete && img.naturalWidth === 0)
              setFailedCoin(coin);
          }}
          onError={() => setFailedCoin(coin)}
        />
      </span>
    );
  }

  const node = (
    <span
      className={cn("relative inline-flex shrink-0", className)}
      style={{ width: size, height: size }}
    >
      {body}
      {showVenue && venueId && <VenueBadge venue={venueId} iconSize={size} />}
    </span>
  );

  // With a venue badge, hovering the token explains what it is, mirroring the
  // fee/impact tooltips elsewhere in the tables.
  const badgeCfg = venueId ? VENUE_BADGE[venueId] : undefined;
  if (!showVenue || !badgeCfg) return node;

  return (
    <Tooltip content={`${coin} perpetual · traded on ${badgeCfg.label}`}>
      {node}
    </Tooltip>
  );
}
