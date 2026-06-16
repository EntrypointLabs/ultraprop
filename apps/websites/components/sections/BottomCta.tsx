export function BottomCta() {
  return (
    <section className="relative overflow-hidden">
      {/* atmospheric backdrop */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-[#1a0d0e] to-[#0a0a0c]" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-2/3 bg-[radial-gradient(60%_120%_at_50%_120%,color-mix(in_oklab,var(--brand)_30%,transparent),transparent_70%)]" />

      <div className="relative mx-auto max-w-[1200px] px-5 pt-28 pb-16 text-center sm:px-8">
        <h2 className="text-4xl font-normal leading-[1.1] sm:text-5xl lg:text-6xl">
          <span className="brand-gradient">Global asset trading.</span>
          <br />
          Transparent settlement.
        </h2>
        <p className="mx-auto mt-6 max-w-md text-balance text-text-muted">
          Trade perpetuals on anything — crypto, metals, energy, stocks and
          indices — and earn your way to a funded account.
        </p>
        <div className="mt-9 flex justify-center">
          <a
            href="#top"
            className="rounded-lg bg-brand px-7 py-3 text-sm font-semibold uppercase tracking-wider text-brand-ink transition-colors hover:bg-brand-hover"
          >
            Start Trading
          </a>
        </div>
      </div>
    </section>
  );
}
