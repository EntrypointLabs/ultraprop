import { Logo } from "@/components/Logo";
import { external, links } from "@/lib/links";

// Self-hosted to avoid hotlink throttling. Source: Unsplash (free license),
// photo-1451187580459-43490279c0fa (Earth at night). Heavily dimmed so it reads
// as atmosphere behind the content, never competing with it.
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
    <div className="relative flex min-h-dvh flex-col overflow-hidden">
      {/* atmospheric backdrop: dark photo, near-black wash, red glow rising from the footer */}
      <div
        aria-hidden
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url("${BG_IMAGE}")` }}
      />
      {/* vertical wash: keeps the lit half of the planet subdued and lands on
          solid near-black under the footer so text always has a dark substrate */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(to bottom, rgba(10,10,12,0.55) 0%, rgba(10,10,12,0.60) 30%, rgba(10,10,12,0.80) 52%, rgba(10,10,12,0.93) 66%, rgba(10,10,12,0.985) 80%, #0a0a0c 100%)",
        }}
      />
      {/* scrim behind the central statement so the headline/CTA never sit on city lights */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(46% 42% at 50% 40%, rgba(10,10,12,0.65), transparent 72%)",
        }}
      />
      {/* faint brand ember rising from the footer */}
      <div
        aria-hidden
        className="absolute inset-x-0 bottom-0 h-[55%]"
        style={{
          background:
            "radial-gradient(60% 80% at 50% 135%, color-mix(in oklab, var(--brand) 24%, transparent), transparent 66%)",
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
          <h1 className="hero-in hero-in-1 text-balance text-4xl font-normal leading-[1.08] sm:text-5xl lg:text-6xl">
            <span className="text-brand">Global asset trading.</span>
            <br />
            Transparent settlement.
          </h1>
          <p className="hero-in hero-in-2 mt-6 max-w-md text-pretty text-text-muted">
            Trade perpetuals on anything: crypto, metals, energy, stocks and
            indices. Prove your edge in simulation and earn your way to a funded
            account.
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
          <div className="grid grid-cols-2 gap-x-8 gap-y-10 border-t border-border-soft pt-12 sm:grid-cols-4">
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
                © 2026 Ultraprop Labs. All rights reserved.
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
