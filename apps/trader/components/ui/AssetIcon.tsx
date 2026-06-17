import type { MarketId } from "@/lib/mock/types";
import { cn } from "@/lib/utils";

export interface AssetIconProps {
  symbol: MarketId;
  size?: number;
  className?: string;
}

/** Hand-tuned brand chips for the markets that have one. */
const TONE: Record<string, { bg: string; fg: string; glyph: string }> = {
  BTC: { bg: "#F7931A", fg: "#0A0A0C", glyph: "₿" },
  ETH: { bg: "#627EEA", fg: "#FFFFFF", glyph: "Ξ" },
  SOL: { bg: "#14F195", fg: "#0A0A0C", glyph: "◎" },
};

/** Deterministic hue from the ticker so any future market renders a stable chip. */
function hashedHue(symbol: string): number {
  let h = 0;
  for (let i = 0; i < symbol.length; i++) {
    h = (h * 31 + symbol.charCodeAt(i)) >>> 0;
  }
  return h % 360;
}

/** Stable initials fallback (first two non-numeric chars, uppercased). */
function initials(symbol: string): string {
  const letters = symbol.replace(/[^a-z]/gi, "");
  return (letters || symbol).slice(0, 2).toUpperCase();
}

export function AssetIcon({ symbol, size = 20, className }: AssetIconProps) {
  const known = TONE[symbol];
  const hue = hashedHue(symbol);
  const bg = known?.bg ?? `hsl(${hue} 55% 42%)`;
  const fg = known?.fg ?? "#FFFFFF";
  const glyph = known?.glyph ?? initials(symbol);

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
      aria-label={symbol}
    >
      {glyph}
    </span>
  );
}
