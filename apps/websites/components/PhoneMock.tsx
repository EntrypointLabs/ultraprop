export function PhoneMock() {
  return (
    <div aria-hidden="true" className="mx-auto w-[300px] max-w-full">
      <div className="rounded-[2.5rem] border border-border bg-surface p-3 shadow-2xl shadow-black/60">
        <div className="overflow-hidden rounded-[2rem] border border-border-soft bg-bg">
          {/* status bar */}
          <div className="flex items-center justify-between px-5 pt-3 text-[11px] text-text-faint">
            <span className="tabular">9:41</span>
            <span>·ıl 5G</span>
          </div>

          {/* asset header */}
          <div className="flex items-center gap-3 px-5 pt-4">
            <div className="flex size-9 items-center justify-center rounded-full bg-brand text-sm font-bold text-brand-ink">
              T
            </div>
            <div>
              <div className="text-sm font-semibold">Tesla</div>
              <div className="text-[11px] text-text-faint">TSLA-PERP</div>
            </div>
            <div className="ml-auto flex size-7 items-center justify-center rounded-full bg-surface-2 text-text-faint">
              ✕
            </div>
          </div>

          {/* big price */}
          <div className="px-5 pt-5">
            <div className="font-display text-4xl font-medium tracking-tight">
              $100,000
            </div>
            <div className="mt-1 text-xs text-up">+$2,480 · +2.54%</div>
          </div>

          {/* mini chart */}
          <div className="mt-4 flex h-20 items-end gap-1 px-5">
            {[30, 42, 36, 50, 44, 58, 52, 66, 60, 74, 70, 82].map((h, i) => (
              <div
                key={i}
                className="flex-1 rounded-sm bg-up/40"
                style={{ height: `${h}%` }}
              />
            ))}
          </div>

          {/* order card */}
          <div className="mt-4 space-y-2 px-5 pb-6">
            <div className="flex items-center justify-between rounded-lg bg-surface-2 px-3 py-2.5 text-xs">
              <span className="text-text-faint">Collateral</span>
              <span className="tabular">1,000 USD</span>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-surface-2 px-3 py-2.5 text-xs">
              <span className="text-text-faint">Leverage</span>
              <span className="tabular">100x</span>
            </div>
            <div className="mt-1 w-full rounded-lg bg-up py-2.5 text-center text-sm font-bold text-black">
              Preview Long
            </div>
            <div className="flex gap-1.5 pt-1">
              {["$10", "$25", "$50", "Max"].map((v) => (
                <span
                  key={v}
                  className="flex-1 rounded-md bg-surface-2 py-1.5 text-center text-[11px] text-text-faint"
                >
                  {v}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
