import { cn } from "@/lib/utils";

export interface IdenticonProps {
  /** wallet address or any seed string */
  address: string;
  size?: number;
  className?: string;
}

const PALETTE = [
  "#e5484d",
  "#7c83c9",
  "#34D399",
  "#38BDF8",
  "#F4C752",
  "#F87171",
];

function hash(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Deterministic 5x5 symmetric identicon derived from the address. Renders the
 * same on server and client (no randomness), so it is hydration-safe.
 */
export function Identicon({ address, size = 24, className }: IdenticonProps) {
  const seed = hash(address || "0x0");
  const color = PALETTE[seed % PALETTE.length];
  const bg = "var(--color-surface-3)";

  const cells: boolean[] = [];
  for (let i = 0; i < 15; i++) {
    cells.push(((seed >> i) & 1) === 1);
  }

  const grid: boolean[][] = [];
  for (let row = 0; row < 5; row++) {
    const r: boolean[] = [];
    for (let col = 0; col < 5; col++) {
      const mirrored = col < 3 ? col : 4 - col;
      r.push(cells[row * 3 + mirrored]);
    }
    grid.push(r);
  }

  const unit = size / 5;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className={cn("shrink-0 rounded-sm", className)}
      style={{ backgroundColor: bg }}
      aria-label="avatar"
    >
      {grid.map((r, row) =>
        r.map((on, col) =>
          on ? (
            <rect
              key={`${row}-${col}`}
              x={col * unit}
              y={row * unit}
              width={unit}
              height={unit}
              fill={color}
            />
          ) : null,
        ),
      )}
    </svg>
  );
}

export { Identicon as Avatar };
