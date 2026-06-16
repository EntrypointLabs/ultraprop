import { Layers, ShieldCheck, ScanLine } from "lucide-react";
import { PhoneMock } from "@/components/PhoneMock";

const FEATURES = [
  {
    icon: Layers,
    title: "Multi-asset",
    body: "Long or short BTC, US100, Gold or Oil with leverage, straight from one account.",
  },
  {
    icon: ShieldCheck,
    title: "No middlemen",
    body: "You keep control end-to-end, with no brokers, no hidden spreads and no frozen balances.",
  },
  {
    icon: ScanLine,
    title: "Auditable by design",
    body: "Every fill, deposit and payout is tracked through open, inspectable settlement.",
  },
];

export function Features() {
  return (
    <section id="features" className="py-24 sm:py-32">
      <div className="mx-auto grid max-w-[1200px] grid-cols-1 items-center gap-12 px-5 sm:px-8 lg:grid-cols-2">
        <div>
          <h2 className="max-w-md text-balance text-4xl font-normal leading-[1.08] sm:text-5xl">
            <span className="text-brand">Traditional assets.</span>
            <br />
            Untraditional infrastructure.
          </h2>

          <div className="mt-10 space-y-7">
            {FEATURES.map((f) => (
              <div key={f.title} className="flex gap-4">
                <div className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-border bg-surface text-brand">
                  <f.icon className="size-5" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-text">{f.title}</h3>
                  <p className="mt-1 max-w-sm text-sm text-text-muted">
                    {f.body}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="relative">
          <div className="hero-glow pointer-events-none absolute inset-0 scale-125" />
          <div className="relative">
            <PhoneMock />
          </div>
        </div>
      </div>
    </section>
  );
}
