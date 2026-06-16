import { ArrowRight } from "lucide-react";
import { TerminalMock } from "@/components/TerminalMock";

const PARTNERS = [
  "Helix Capital",
  "Meridian",
  "Lattice",
  "North Peak",
  "Catalyst",
  "Outset",
];

export function Hero() {
  return (
    <section id="top" className="relative overflow-hidden pt-32 pb-16 sm:pt-40">
      <div className="hero-glow pointer-events-none absolute inset-x-0 top-0 h-[600px]" />

      <div className="relative mx-auto max-w-[1200px] px-5 text-center sm:px-8">
        {/* announcement pill */}
        <a
          href="#press"
          className="lift mx-auto mb-8 inline-flex items-center gap-2 rounded-full border border-border bg-surface/60 py-1.5 pl-4 pr-3 text-xs text-text-muted backdrop-blur"
        >
          <span className="size-1.5 rounded-full bg-brand" />
          Announcing: the new Ultraprop evaluation engine
          <ArrowRight className="size-3.5" />
        </a>

        <h1 className="mx-auto max-w-4xl text-balance text-5xl font-normal leading-[1.05] sm:text-6xl lg:text-7xl">
          Your gateway to <span className="brand-gradient">global markets</span>
        </h1>

        <p className="mx-auto mt-6 max-w-xl text-balance text-base text-text-muted sm:text-lg">
          Trade perpetuals on crypto, indices and commodities against live
          market prices. Prove your edge in simulation, clear the evaluation,
          and trade a funded account.
        </p>

        <div className="mt-9 flex justify-center">
          <a
            href="#top"
            className="rounded-lg bg-brand px-7 py-3 text-sm font-semibold uppercase tracking-wider text-brand-ink transition-colors hover:bg-brand-hover"
          >
            Start Trading
          </a>
        </div>

        {/* partner logos */}
        <div className="mt-14 flex flex-wrap items-center justify-center gap-x-10 gap-y-4">
          {PARTNERS.map((p) => (
            <span
              key={p}
              className="text-sm font-semibold tracking-wide text-text-faint/70 grayscale transition-opacity hover:opacity-90"
            >
              {p}
            </span>
          ))}
        </div>

        {/* product panel */}
        <div className="relative mx-auto mt-16 max-w-4xl">
          <div className="hero-glow pointer-events-none absolute -inset-x-10 -top-10 bottom-0" />
          <div className="relative">
            <TerminalMock />
          </div>
        </div>
      </div>
    </section>
  );
}
