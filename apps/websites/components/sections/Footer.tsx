import { Logo } from "@/components/Logo";
import { links } from "@/lib/links";

type FooterLink = { label: string; href: string; external?: boolean };

const COLUMNS: { title: string; links: FooterLink[] }[] = [
  {
    title: "Product",
    links: [
      { label: "Trade", href: links.app, external: true },
      { label: "Evaluations", href: links.app, external: true },
      { label: "Funding", href: links.app, external: true },
      { label: "Referrals", href: links.app, external: true },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "Careers", href: "/careers" },
      { label: "Terms & Conditions", href: "/terms" },
      { label: "Privacy Policy", href: "/privacy" },
      { label: "Contact", href: "/contact" },
      { label: "Media Kit", href: "/media-kit" },
    ],
  },
  {
    title: "Developers",
    links: [
      { label: "Documentation", href: links.docs, external: true },
      { label: "Status", href: "https://status.ultraprop.xyz", external: true },
      { label: "API", href: `${links.docs}/api`, external: true },
    ],
  },
  {
    title: "Community",
    links: [
      { label: "X / Twitter", href: links.x, external: true },
      { label: "Discord", href: links.discord, external: true },
      { label: "Telegram", href: links.telegram, external: true },
      { label: "Blog", href: links.blog, external: true },
    ],
  },
];

export function Footer() {
  return (
    <footer
      id="footer"
      className="relative border-t border-border-soft bg-[#0a0a0c]"
    >
      <div className="mx-auto max-w-[1200px] px-5 py-14 sm:px-8">
        <div className="grid grid-cols-2 gap-10 sm:grid-cols-4">
          {COLUMNS.map((col) => (
            <div key={col.title}>
              <h4 className="text-sm font-semibold text-text">{col.title}</h4>
              <ul className="mt-4 space-y-3">
                {col.links.map((link) => (
                  <li key={link.label}>
                    <a
                      href={link.href}
                      {...(link.external
                        ? { target: "_blank", rel: "noopener noreferrer" }
                        : {})}
                      className="text-sm text-text-faint transition-colors hover:text-text"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-14 border-t border-border-soft pt-8">
          <Logo size={20} />
          <p className="mt-5 max-w-4xl text-xs leading-relaxed text-text-faint">
            Trading leveraged derivatives carries a high level of risk and may
            not be suitable for every investor. Simulated and funded results do
            not guarantee future performance. Before trading, consider your
            objectives, experience and risk appetite. Nothing on this site is
            financial advice. Ultraprop accounts trade against live market prices
            in simulation; eligibility and account terms vary by jurisdiction.
          </p>
          <p className="mt-6 text-xs text-text-faint">
            © 2026 Ultraprop Labs. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
