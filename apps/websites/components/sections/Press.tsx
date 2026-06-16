import { ArrowUpRight } from "lucide-react";

const BLOG = [
  {
    title: "Market Outlook #62",
    date: "Nov 26, 2025",
    body: "This week's read across Bitcoin, Ethereum, the dollar index, gold and the S&P 500.",
  },
  {
    title: "Market Outlook #61",
    date: "Nov 23, 2025",
    body: "Single-name focus: where the large-cap tech and crypto-adjacent equities are heading.",
  },
];

const COVERAGE = [
  { source: "Press", tag: "Feature", date: "Dec 3, 2025", title: "How a paper-first prop firm is rethinking trader funding" },
  { source: "Press", tag: "Partnership", date: "May 18, 2026", title: "Ultraprop expands its equity-index perpetual catalog" },
  { source: "Press", tag: "Launch", date: "Apr 28, 2026", title: "A new settlement layer for simulated and funded accounts" },
  { source: "Press", tag: "Interview", date: "Feb 3, 2026", title: "Why discipline beats deposits for the next wave of traders" },
  { source: "Press", tag: "Market Talk", date: "Apr 1, 2026", title: "Energy and metals: positioning into the next quarter" },
  { source: "Press", tag: "Outlook", date: "Jan 21, 2026", title: "Reading macro through the lens of a funded desk" },
];

export function Press() {
  return (
    <section id="press" className="py-24 sm:py-28">
      <div className="mx-auto max-w-[1200px] px-5 sm:px-8">
        <h2 className="text-center text-4xl font-normal sm:text-5xl">
          Press &amp; Coverage
        </h2>

        {/* Blog */}
        <div className="mt-14">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-text-muted">Blog</h3>
            <a
              href="#press"
              className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-text-faint hover:text-text"
            >
              More <ArrowUpRight className="size-3.5" />
            </a>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {BLOG.map((p) => (
              <a
                key={p.title}
                href="#press"
                className="lift rounded-2xl border border-border bg-surface/50 p-6 hover:border-border"
              >
                <p className="text-sm text-text-muted">{p.body}</p>
                <div className="mt-6 flex items-center justify-between">
                  <span className="font-medium text-text">{p.title}</span>
                  <span className="text-xs text-text-faint">{p.date}</span>
                </div>
              </a>
            ))}
          </div>
        </div>

        {/* Media coverage */}
        <div className="mt-12">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-text-muted">
              Media Coverage
            </h3>
            <a
              href="#press"
              className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-text-faint hover:text-text"
            >
              More <ArrowUpRight className="size-3.5" />
            </a>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {COVERAGE.map((c) => (
              <a
                key={c.title}
                href="#press"
                className="lift overflow-hidden rounded-2xl border border-border bg-surface/50"
              >
                <div className="flex h-32 items-center justify-center bg-gradient-to-br from-surface-2 to-surface-3 text-sm font-semibold text-text-faint">
                  {c.source}
                </div>
                <div className="p-5">
                  <div className="flex items-center gap-2 text-[11px] text-text-faint">
                    <span className="uppercase tracking-wide">{c.tag}</span>
                    <span>·</span>
                    <span>{c.date}</span>
                  </div>
                  <p className="mt-2 text-sm font-medium text-text">{c.title}</p>
                </div>
              </a>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
