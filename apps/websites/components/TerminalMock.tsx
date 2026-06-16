const ROWS = [
  { sym: "BTC-PERP", side: "Long", lev: "10x", size: "12,480", pnl: "+482.10", up: true },
  { sym: "ETH-PERP", side: "Long", lev: "5x", size: "8,210", pnl: "+118.44", up: true },
  { sym: "SOL-PERP", side: "Short", lev: "8x", size: "5,940", pnl: "-64.20", up: false },
  { sym: "US100", side: "Long", lev: "20x", size: "21,300", pnl: "+1,204.66", up: true },
  { sym: "XAU", side: "Short", lev: "4x", size: "3,120", pnl: "-12.88", up: false },
];

const BARS = [38, 52, 44, 61, 49, 67, 58, 72, 64, 80, 71, 86, 78, 92, 84];

export function TerminalMock() {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface/80 shadow-2xl shadow-black/50 backdrop-blur">
      {/* top bar */}
      <div className="flex items-center gap-4 border-b border-border-soft px-4 py-2.5">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <span className="size-2 rounded-full bg-brand" />
          BTC-PERP
        </div>
        <span className="tabular text-sm">$67,412.50</span>
        <span className="tabular text-xs text-up">+1.84%</span>
        <span className="ml-auto flex items-center gap-1.5 text-[11px] text-text-faint">
          <span className="size-1.5 rounded-full bg-up live-pulse" /> Live
        </span>
      </div>

      <div className="grid gap-px bg-border-soft md:grid-cols-[1.6fr_1fr]">
        {/* chart */}
        <div className="bg-surface p-4">
          <div className="flex h-44 items-end gap-1.5">
            {BARS.map((h, i) => (
              <div
                key={i}
                className="flex-1 rounded-sm"
                style={{
                  height: `${h}%`,
                  background:
                    i === BARS.length - 1
                      ? "var(--up)"
                      : "color-mix(in oklab, var(--up) 35%, transparent)",
                }}
              />
            ))}
          </div>
          <div className="mt-3 flex justify-between text-[10px] text-text-faint">
            <span>09:30</span>
            <span>12:00</span>
            <span>14:30</span>
            <span>16:00</span>
          </div>
        </div>

        {/* order ticket */}
        <div className="bg-surface p-4">
          <div className="mb-3 flex gap-1.5">
            <button className="flex-1 rounded-md bg-up/15 py-1.5 text-xs font-semibold text-up">
              Long
            </button>
            <button className="flex-1 rounded-md bg-surface-2 py-1.5 text-xs font-semibold text-text-faint">
              Short
            </button>
          </div>
          <div className="space-y-2.5 text-xs">
            <div className="flex items-center justify-between rounded-md bg-surface-2 px-3 py-2">
              <span className="text-text-faint">Collateral</span>
              <span className="tabular">1,000 USD</span>
            </div>
            <div className="flex items-center justify-between rounded-md bg-surface-2 px-3 py-2">
              <span className="text-text-faint">Leverage</span>
              <span className="tabular">10x</span>
            </div>
            <div className="flex items-center justify-between rounded-md bg-surface-2 px-3 py-2">
              <span className="text-text-faint">Liq. Price</span>
              <span className="tabular">$60,914.20</span>
            </div>
          </div>
          <button className="mt-3 w-full rounded-md bg-up py-2 text-xs font-bold text-black">
            Preview Long
          </button>
        </div>
      </div>

      {/* positions table */}
      <div className="border-t border-border-soft">
        <div className="grid grid-cols-[1.4fr_0.8fr_0.6fr_1fr_1fr] gap-2 px-4 py-2 text-[10px] uppercase tracking-wide text-text-faint">
          <span>Market</span>
          <span>Side</span>
          <span>Lev</span>
          <span className="text-right">Size</span>
          <span className="text-right">PnL</span>
        </div>
        {ROWS.map((r) => (
          <div
            key={r.sym}
            className="grid grid-cols-[1.4fr_0.8fr_0.6fr_1fr_1fr] gap-2 border-t border-border-soft/60 px-4 py-2 text-xs"
          >
            <span className="font-medium">{r.sym}</span>
            <span className={r.side === "Long" ? "text-up" : "text-down"}>
              {r.side}
            </span>
            <span className="tabular text-text-muted">{r.lev}</span>
            <span className="tabular text-right text-text-muted">{r.size}</span>
            <span
              className={`tabular text-right ${r.up ? "text-up" : "text-down"}`}
            >
              {r.pnl}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
