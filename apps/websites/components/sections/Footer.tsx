import { Logo } from "@/components/Logo";

const COLUMNS: { title: string; links: string[] }[] = [
  { title: "Product", links: ["Trade", "Evaluations", "Funding", "Referrals"] },
  {
    title: "Company",
    links: ["Careers", "Terms & Conditions", "Privacy Policy", "Contact", "Media Kit"],
  },
  { title: "Developers", links: ["Documentation", "Status", "API"] },
  { title: "Community", links: ["X / Twitter", "Discord", "Telegram", "Blog"] },
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
                  <li key={link}>
                    <a
                      href="#top"
                      className="text-sm text-text-faint transition-colors hover:text-text"
                    >
                      {link}
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
