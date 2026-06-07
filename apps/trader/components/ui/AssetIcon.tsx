import type { Symbol } from "@/lib/mock/types";
import { cn } from "@/lib/utils";

export interface AssetIconProps {
  symbol: Symbol;
  size?: number;
  className?: string;
}

const tone: Record<Symbol, { bg: string; fg: string; glyph: string }> = {
  BTC: { bg: "#F7931A", fg: "#0A0A0C", glyph: "₿" },
  ETH: { bg: "#627EEA", fg: "#FFFFFF", glyph: "Ξ" },
  SOL: { bg: "#14F195", fg: "#0A0A0C", glyph: "◎" },
};

export function AssetIcon({ symbol, size = 20, className }: AssetIconProps) {
  const t = tone[symbol];
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-semibold",
        className,
      )}
      style={{
        width: size,
        height: size,
        backgroundColor: t.bg,
        color: t.fg,
        fontSize: size * 0.55,
        lineHeight: 1,
      }}
      aria-label={symbol}
    >
      {t.glyph}
    </span>
  );
}
