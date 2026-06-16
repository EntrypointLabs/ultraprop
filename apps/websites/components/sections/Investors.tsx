const INVESTORS = [
  "Helix Capital",
  "Meridian Ventures",
  "Lattice",
  "North Peak",
  "Catalyst Fund",
  "Outset",
];

export function Investors() {
  return (
    <section className="py-24 sm:py-28">
      <div className="mx-auto max-w-[1200px] px-5 sm:px-8">
        <h2 className="text-center text-4xl font-normal sm:text-5xl">
          <span className="brand-gradient">Backed by leading investors</span>
        </h2>

        <div className="mx-auto mt-12 max-w-3xl rounded-2xl border border-border bg-surface/60 p-8 sm:p-12">
          <blockquote className="text-balance text-xl leading-relaxed text-text sm:text-2xl">
            “Ultraprop gives traders a clean, transparent path to capital. It
            pairs the speed of on-chain settlement with the discipline of a real
            evaluation — a genuinely new way to access global markets.”
          </blockquote>
          <div className="mt-8 flex items-center gap-4">
            <div className="flex size-12 items-center justify-center rounded-full bg-surface-2 font-display text-lg text-text-muted">
              A
            </div>
            <div>
              <div className="font-semibold text-text">Partner</div>
              <div className="text-sm text-text-muted">Helix Capital</div>
            </div>
          </div>
        </div>

        <div className="mt-14 flex flex-wrap items-center justify-center gap-x-12 gap-y-6">
          {INVESTORS.map((name) => (
            <span
              key={name}
              className="text-base font-semibold tracking-wide text-text-faint/70"
            >
              {name}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
