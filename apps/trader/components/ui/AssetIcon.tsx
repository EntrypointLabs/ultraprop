"use client";

import { useState } from "react";
import { coinOf } from "@/lib/mock/markets";
import type { MarketId } from "@/lib/mock/types";
import { cn } from "@/lib/utils";

export interface AssetIconProps {
  symbol: MarketId;
  size?: number;
  className?: string;
}

/** Hand-tuned brand chips, shown only when the live logo fails to load. */
const TONE: Record<string, { bg: string; fg: string; glyph: string }> = {
  BTC: { bg: "#F7931A", fg: "#0A0A0C", glyph: "₿" },
  ETH: { bg: "#627EEA", fg: "#FFFFFF", glyph: "Ξ" },
  SOL: { bg: "#14F195", fg: "#0A0A0C", glyph: "◎" },
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

export function AssetIcon({ symbol, size = 20, className }: AssetIconProps) {
  const coin = coinOf(symbol);
  const [failedCoin, setFailedCoin] = useState<string | null>(null);

  if (failedCoin === coin) {
    const known = TONE[coin];
    const bg = known?.bg ?? `hsl(${hashedHue(coin)} 55% 42%)`;
    const fg = known?.fg ?? "#FFFFFF";
    const glyph = known?.glyph ?? initials(coin);
    return (
      <span
        className={cn(
          "inline-flex shrink-0 items-center justify-center rounded-full font-semibold",
          className,
        )}
        style={{
          width: size,
          height: size,
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
  }

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-white",
        className,
      )}
      style={{ width: size, height: size }}
    >
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
          if (img && img.complete && img.naturalWidth === 0) setFailedCoin(coin);
        }}
        onError={() => setFailedCoin(coin)}
      />
    </span>
  );
}
