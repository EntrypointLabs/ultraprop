import { Logo } from "@/components/Logo";
import { external, links } from "@/lib/links";

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

export function SiteFooter() {
  return (
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
            Trading leveraged derivatives carries a high level of risk and may
            not be suitable for every investor. Simulated and funded results do
            not guarantee future performance. Before trading, consider your
            objectives, experience and risk appetite. Nothing on this site is
            financial advice. Ultraprop accounts trade against live market
            prices in simulation; eligibility and account terms vary by
            jurisdiction.
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
  );
}
