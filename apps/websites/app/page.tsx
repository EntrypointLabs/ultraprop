import { Logo } from "@/components/Logo";
import { external, links } from "@/lib/links";

// Self-hosted to avoid hotlink throttling. Source: Unsplash (free license),
// photo-1464822759023-fed622ff2c3b (mountain valley). A bright daytime shot,
// pushed to a dark red duotone in CSS so it reads as a moody, branded scene.
const BG_IMAGE = "/footer-backdrop.jpg";

type FooterItem = {
  label: string;
  href?: string;
  external?: boolean;
  soon?: boolean;
};

const COLUMNS: { title: string; items: FooterItem[] }[] = [
  {
    title: "Product",
    items: [
      { label: "Trade", href: links.app, external: true },
      { label: "Vaults", href: links.app, external: true },
      { label: "Evaluations", href: links.app, external: true },
      { label: "Leaderboard", href: links.app, external: true },
    ],
  },
  {
    title: "Features",
    items: [
      { label: "Live market data", href: links.docs, external: true },
      { label: "Slippage preview", href: links.docs, external: true },
      { label: "Genesis credential", href: links.docs, external: true },
      { label: "Tier ladder", href: links.docs, external: true },
    ],
  },
  {
    title: "Developers",
    items: [
      { label: "Documentation", href: links.docs, external: true },
      { label: "Protocol Explorer", soon: true },
      { label: "API", href: `${links.docs}/api`, external: true },
    ],
  },
  {
    title: "Social Media",
    items: [
      { label: "X / Twitter", href: links.x, external: true },
      { label: "Discord", soon: true },
      { label: "Telegram", soon: true },
    ],
  },
];

const LEGAL = [
  { label: "Terms & Conditions", href: "/terms" },
  { label: "Privacy Policy", href: "/privacy" },
  { label: "Media Kit", href: "/media-kit" },
];

function FooterLink({ item }: { item: FooterItem }) {
  if (item.soon) {
    return (
      <span className="inline-flex cursor-default items-center gap-2 text-sm text-text-muted">
        {item.label}
        <span className="rounded-full border border-border px-1.5 py-px text-[10px] font-medium uppercase tracking-wide text-text-faint">
          Soon
        </span>
      </span>
    );
  }
  return (
    <a
      href={item.href}
      {...(item.external ? external : {})}
      className="text-sm text-text-muted transition-colors hover:text-text"
    >
      {item.label}
    </a>
  );
}

export default function Page() {
  return (
    <div className="relative isolate flex min-h-dvh flex-col overflow-hidden bg-bg">
      {/* backdrop image */}
      <div
        aria-hidden
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url("${BG_IMAGE}")` }}
      />
      {/* red duotone: multiply pushes the daytime greens/blues into deep brand-warm tones */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{ background: "#6e1a1d", mixBlendMode: "multiply" }}
      />
      {/* vertical wash: darkens overall, heaviest at the top (headline) and bottom
          (footer) so text always lands on a near-black substrate */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(to bottom, rgba(10,10,12,0.74) 0%, rgba(10,10,12,0.52) 30%, rgba(10,10,12,0.72) 58%, rgba(10,10,12,0.93) 80%, #0a0a0c 100%)",
        }}
      />
      {/* scrim behind the central statement */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(48% 44% at 50% 40%, rgba(10,10,12,0.6), transparent 72%)",
        }}
      />
      {/* warm brand ember rising from the footer, like Ostium's horizon glow */}
      <div
        aria-hidden
        className="absolute inset-x-0 bottom-0 h-[62%]"
        style={{
          background:
            "radial-gradient(72% 90% at 50% 128%, color-mix(in oklab, var(--brand) 34%, transparent), transparent 64%)",
        }}
      />

      {/* foreground */}
      <div className="relative z-10 flex min-h-dvh flex-col">
        {/* top bar */}
        <header className="mx-auto flex w-full max-w-[1200px] items-center justify-between px-5 py-6 sm:px-8">
          <a href={links.home} aria-label="Ultraprop home">
            <Logo size={22} />
          </a>
          <a
            href={links.app}
            {...external}
            className="rounded-lg bg-brand-button px-4 py-2 text-xs font-semibold uppercase tracking-wider text-brand-ink transition-colors hover:bg-brand-active"
          >
            Launch App
          </a>
        </header>

        {/* centered statement */}
        <main className="mx-auto flex w-full max-w-[1200px] flex-1 flex-col items-center justify-center px-5 py-20 text-center sm:px-8">
          <h1 className="hero-in hero-in-1 font-display text-balance text-4xl font-normal leading-[1.1] sm:text-5xl lg:text-6xl">
            <span className="text-brand">On-chain crypto trading.</span>
            <br />
            Earn a funded account.
          </h1>
          <p className="hero-in hero-in-2 mt-6 max-w-md text-pretty text-text-muted">
            Trade BTC, ETH and SOL perpetuals against live market prices. Prove
            your edge in simulation, clear the evaluation, and trade the
            firm&apos;s capital, fully on-chain.
          </p>
          <div className="hero-in hero-in-3 mt-9">
            <a
              href={links.app}
              {...external}
              className="rounded-lg bg-brand-button px-7 py-3 text-sm font-semibold uppercase tracking-wider text-brand-ink transition-colors hover:bg-brand-active"
            >
              Start Trading
            </a>
          </div>
        </main>

        {/* footer */}
        <footer className="mx-auto w-full max-w-[1200px] px-5 pb-12 sm:px-8">
          <div className="grid grid-cols-2 gap-x-8 gap-y-10 pt-12 sm:flex sm:justify-between sm:gap-x-12">
            {COLUMNS.map((col) => (
              <div key={col.title}>
                <h2 className="text-sm font-semibold text-text">{col.title}</h2>
                <ul className="mt-4 space-y-3">
                  {col.items.map((item) => (
                    <li key={item.label}>
                      <FooterLink item={item} />
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="mt-12 border-t border-border-soft pt-8">
            <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
              <Logo size={20} />
              <p className="max-w-2xl text-xs leading-relaxed text-text-faint">
                Trading leveraged derivatives carries a high level of risk and
                may not be suitable for every investor. Simulated and funded
                results do not guarantee future performance. Before trading,
                consider your objectives, experience and risk appetite. Nothing
                on this site is financial advice. Ultraprop accounts trade
                against live market prices in simulation; eligibility and
                account terms vary by jurisdiction.
              </p>
            </div>

            <div className="mt-8 flex flex-col-reverse gap-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-text-faint">
                © 2026{" "}
                <a
                  href="https://entrypointlabs.xyz"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="transition-colors hover:text-text"
                >
                  Entrypoint Labs
                </a>
                . All rights reserved.
              </p>
              <nav className="flex flex-wrap gap-x-6 gap-y-2">
                {LEGAL.map((l) => (
                  <a
                    key={l.label}
                    href={l.href}
                    className="text-xs text-text-faint transition-colors hover:text-text"
                  >
                    {l.label}
                  </a>
                ))}
              </nav>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
