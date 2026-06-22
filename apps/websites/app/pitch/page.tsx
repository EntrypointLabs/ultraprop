import type { Metadata } from "next";
import { Logo } from "@/components/Logo";
import { SiteFooter } from "@/components/SiteFooter";
import { external, links } from "@/lib/links";

export const metadata: Metadata = {
  title: "The pitch · Ultraprop",
  description:
    "A prop firm where the rules, the track record, and the payout all live on-chain. Prove your edge against live market prices, and prove that you proved it.",
  openGraph: {
    title: "The pitch · Ultraprop",
    description:
      "A prop firm where the rules, the track record, and the payout all live on-chain. Prove your edge against live market prices, and prove that you proved it.",
    url: "https://ultraprop.xyz/pitch",
    siteName: "Ultraprop",
    images: ["https://ultraprop.xyz/og-image.png"],
    locale: "en_US",
    type: "website",
  },
};

const EXPLORER = "https://suiscan.xyz/testnet/object/";

// The landing page's footer-backdrop scene, reused at the foot of this page.
const BG_IMAGE = "/footer-backdrop.jpg";

const PROBLEMS = [
  {
    title: "The rules are theirs",
    body: "Drawdown and breach are flagged by the firm's software and judged by its back office, so they bend when a payout is due.",
  },
  {
    title: "The record is theirs",
    body: "Your wins, your discipline, your equity curve sit in a private database you cannot export, prove, or take with you.",
  },
  {
    title: "The payout is theirs",
    body: "Traders are regularly denied money they earned, because the firm is the scorekeeper, the referee, and the bank at once.",
  },
];

const DIFFERENTIATORS = [
  {
    title: "Rules enforced by code",
    body: "Profit target, max drawdown, and daily loss live inside the evaluation contract. Break one and the evaluation ends in that instant, with no override and no appeal.",
  },
  {
    title: "Verifiable track record",
    body: "Every account, trade, and pass or fail is recorded on-chain. Your performance is something you can hand to anyone and have them check themselves.",
  },
  {
    title: "Proof-of-skill credential",
    body: "Passing mints a soulbound Genesis credential, and an on-chain reputation grows trade by trade. You carry it between firms and protocols.",
  },
  {
    title: "Auditable capital",
    body: "The firm's funding sits in an on-chain vault with on-chain solvency, so anyone can confirm the firm can cover what it owes.",
  },
  {
    title: "Stablecoin payouts",
    body: "Profits settle in stablecoins, in minutes, anywhere, with the evaluation fee refunded on your first payout.",
  },
  {
    title: "Invisible chain",
    body: "Sign in with email and trade. Everything on-chain happens in the background, with no wallet, seed phrase, or gas to manage.",
  },
];

const SUI_REASONS = [
  {
    title: "Object model",
    body: "Accounts, trades, and credentials are first-class on-chain objects, cheap enough to record every trade rather than a sample.",
  },
  {
    title: "Move resource safety",
    body: "The treasury and vault are resource-safe by construction, so the same capital cannot back two positions at once.",
  },
  {
    title: "Revocable capabilities",
    body: "Operator authority is held as capabilities that can be revoked on-chain in an instant, so a compromised key is cut off at once.",
  },
  {
    title: "Sponsored transactions",
    body: "The firm pays for execution, so a trader onboards with nothing but an email and never touches gas.",
  },
];

const PROOF = [
  {
    label: "Package",
    id: "0xf5c878892e943217b1104e584a15060212a1468b0dc41b685bd507bf85ccfbfe",
  },
  {
    label: "Account Registry",
    id: "0x300ed469593be651c2ec0c9155184f03f2d4aa0920b4c5382f075a267de5237b",
  },
  {
    label: "Treasury",
    id: "0x3d395ecad657e0621a539ad1d3a672de92df9387dbf86b97cf67d2f648853208",
  },
  {
    label: "Tier Config",
    id: "0x7cc46cf18b73f789db18d944a8e3bf36bdde6e0b4d5c7fd856e381eb14c4f577",
  },
];

const ROADMAP = [
  {
    phase: "v1 · live today",
    title: "On-chain evaluation",
    body: "An invite-led, paper-trading beta. Trade live market prices with the full risk engine running, your record written to Sui, no real capital at stake yet.",
    points: [
      "Live perpetual market prices in simulation",
      "Contract-enforced rules and breach",
      "On-chain record and Genesis credential",
    ],
  },
  {
    phase: "v2 · next",
    title: "The funded firm",
    body: "Pass, and you trade real capital from an on-chain vault. The same surface, now with profit splits and payouts settled in stablecoins.",
    points: [
      "Real capital from an auditable vault",
      "Profit splits and a scaling ladder",
      "Stablecoin payouts, fee refunded on the first",
    ],
  },
];

export default function PitchPage() {
  return (
    <div className="relative isolate flex min-h-dvh flex-col overflow-hidden bg-bg">
      {/* hero atmosphere: a warm brand ember at the top, fading into the canvas */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[900px]"
      >
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(60% 46% at 50% -6%, color-mix(in oklab, var(--brand) 26%, transparent), transparent 70%)",
          }}
        />
        <div
          className="absolute inset-x-0 bottom-0 h-40"
          style={{
            background: "linear-gradient(to bottom, transparent, #0a0a0c)",
          }}
        />
      </div>

      {/* footer atmosphere: the landing's backdrop scene rising under the closing
          CTA and footer, pushed to a deep red duotone. The vertical wash keeps the
          dense footer copy on a near-black substrate so it stays legible. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-[860px]"
      >
        <div
          className="absolute inset-0 bg-cover bg-bottom"
          style={{ backgroundImage: `url("${BG_IMAGE}")` }}
        />
        <div
          className="absolute inset-0"
          style={{ background: "#6e1a1d", mixBlendMode: "multiply" }}
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(to bottom, #0a0a0c 0%, rgba(10,10,12,0.5) 20%, rgba(10,10,12,0.42) 34%, rgba(10,10,12,0.72) 54%, rgba(10,10,12,0.9) 80%, #0a0a0c 100%)",
          }}
        />
        <div
          className="absolute inset-x-0 bottom-0 h-[70%]"
          style={{
            background:
              "radial-gradient(72% 90% at 50% 128%, color-mix(in oklab, var(--brand) 30%, transparent), transparent 64%)",
          }}
        />
      </div>

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

      <main className="mx-auto w-full max-w-[1200px] flex-1 px-5 sm:px-8">
        {/* hero */}
        <section className="flex flex-col items-center pt-16 pb-24 text-center sm:pt-24">
          <span className="hero-in hero-in-1 inline-flex items-center gap-2 rounded-full border border-border bg-surface/60 px-3 py-1 text-xs text-text-muted">
            <span className="size-1.5 rounded-full bg-up live-pulse" />
            Live on Sui testnet · paper-trading beta
          </span>
          <h1 className="hero-in hero-in-2 mt-7 max-w-4xl text-balance font-display text-4xl font-normal leading-[1.08] sm:text-5xl lg:text-6xl">
            A prop firm where the rules, the record, and the payout all live{" "}
            <span className="text-brand">on-chain</span>.
          </h1>
          <p className="hero-in hero-in-3 mt-6 max-w-xl text-pretty text-lg text-text-muted">
            Think FTMO, but the rules are enforced by code, your track record is
            verifiable by anyone, and your payout is not up for debate. Prove
            your edge, and prove that you proved it.
          </p>
          <div className="hero-in hero-in-4 mt-9 flex flex-wrap items-center justify-center gap-3">
            <a
              href={links.app}
              {...external}
              className="rounded-lg bg-brand-button px-7 py-3 text-sm font-semibold uppercase tracking-wider text-brand-ink transition-colors hover:bg-brand-active"
            >
              Start Trading
            </a>
            <a
              href={links.docs}
              {...external}
              className="rounded-lg border border-border px-7 py-3 text-sm font-semibold uppercase tracking-wider text-text transition-colors hover:border-text-faint hover:bg-surface"
            >
              Read the docs
            </a>
          </div>
        </section>

        {/* the problem */}
        <section className="border-t border-border-soft py-20 sm:py-24">
          <h2 className="max-w-2xl text-balance font-display text-3xl font-normal leading-tight sm:text-4xl">
            Prop trading runs on trust the firm controls.
          </h2>
          <p className="mt-5 max-w-2xl text-pretty text-text-muted">
            The model is proven and worth billions. Pay a fee, pass an
            evaluation, and trade the firm's money for a cut of the profit. The
            model works. The trust does not.
          </p>
          <div className="mt-12 grid gap-y-8 sm:grid-cols-3 sm:gap-0 sm:divide-x sm:divide-border-soft">
            {PROBLEMS.map((item) => (
              <div
                key={item.title}
                className="sm:px-7 sm:first:pl-0 sm:last:pr-0"
              >
                <h3 className="font-display text-lg text-text">{item.title}</h3>
                <p className="mt-3 max-w-sm text-sm leading-relaxed text-text-muted">
                  {item.body}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* what makes it different */}
        <section className="border-t border-border-soft py-20 sm:py-24">
          <h2 className="max-w-2xl text-balance font-display text-3xl font-normal leading-tight sm:text-4xl">
            Replace the trust with proof.
          </h2>
          <p className="mt-5 max-w-2xl text-pretty text-text-muted">
            Ultraprop rebuilds the prop firm on Sui, so the parts that used to
            depend on the firm's word are enforced and recorded by code.
          </p>
          <div className="mt-12 grid grid-cols-1 gap-px overflow-hidden rounded-xl border border-border bg-border-soft sm:grid-cols-2 lg:grid-cols-3">
            {DIFFERENTIATORS.map((item) => (
              <div
                key={item.title}
                className="bg-bg p-6 transition-colors hover:bg-surface"
              >
                <h3 className="font-display text-lg text-text">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-text-muted">
                  {item.body}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* why sui */}
        <section className="border-t border-border-soft py-20 sm:py-24">
          <h2 className="max-w-2xl text-balance font-display text-3xl font-normal leading-tight sm:text-4xl">
            This only works cleanly on Sui.
          </h2>
          <div className="mt-12 grid gap-x-12 gap-y-9 sm:grid-cols-2">
            {SUI_REASONS.map((item) => (
              <div key={item.title}>
                <h3 className="font-display text-lg text-text">{item.title}</h3>
                <p className="mt-2 max-w-md text-sm leading-relaxed text-text-muted">
                  {item.body}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* proof on-chain */}
        <section className="border-t border-border-soft py-20 sm:py-24">
          <h2 className="max-w-2xl text-balance font-display text-3xl font-normal leading-tight sm:text-4xl">
            Verify it on-chain.
          </h2>
          <p className="mt-5 max-w-2xl text-pretty text-text-muted">
            The full contract suite is deployed and live on Sui testnet. Open
            any object in an explorer to see the registries, tier economics, and
            trade and pass events for yourself.
          </p>
          <div className="mt-10 overflow-hidden rounded-xl border border-border bg-surface/40">
            {PROOF.map((item, index) => (
              <a
                key={item.label}
                href={`${EXPLORER}${item.id}`}
                {...external}
                className={`group flex flex-col gap-1 px-5 py-4 transition-colors hover:bg-surface-2 sm:flex-row sm:items-center sm:gap-4 ${
                  index > 0 ? "border-t border-border-soft" : ""
                }`}
              >
                <span className="w-40 shrink-0 text-sm font-medium text-text">
                  {item.label}
                </span>
                <span className="tabular truncate text-xs text-text-muted transition-colors group-hover:text-text">
                  {item.id}
                </span>
                <span className="ml-auto hidden shrink-0 text-xs uppercase tracking-wider text-text-faint transition-colors group-hover:text-brand sm:inline">
                  View ↗
                </span>
              </a>
            ))}
          </div>
        </section>

        {/* roadmap */}
        <section className="border-t border-border-soft py-20 sm:py-24">
          <h2 className="max-w-2xl text-balance font-display text-3xl font-normal leading-tight sm:text-4xl">
            Honest today, funded next.
          </h2>
          <div className="mt-12 grid gap-4 md:grid-cols-2">
            {ROADMAP.map((stage) => (
              <div
                key={stage.phase}
                className="rounded-xl border border-border bg-surface/40 p-7"
              >
                <span className="text-xs font-semibold uppercase tracking-[0.16em] text-brand">
                  {stage.phase}
                </span>
                <h3 className="mt-3 font-display text-2xl text-text">
                  {stage.title}
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-text-muted">
                  {stage.body}
                </p>
                <ul className="mt-5 space-y-2.5">
                  {stage.points.map((point) => (
                    <li
                      key={point}
                      className="flex items-start gap-3 text-sm text-text-muted"
                    >
                      <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-brand" />
                      {point}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        {/* closing cta */}
        <section className="border-t border-border-soft py-24 text-center sm:py-28">
          <h2 className="mx-auto max-w-2xl text-balance font-display text-3xl font-normal leading-tight sm:text-5xl">
            <span className="text-brand">Prove your edge.</span> Earn a funded
            account.
          </h2>
          <p className="mx-auto mt-5 max-w-md text-pretty text-text-muted">
            Live prices, contract-enforced rules, and a track record that is
            yours. Prove it, never just promise it.
          </p>
          <div className="mt-9">
            <a
              href={links.app}
              {...external}
              className="rounded-lg bg-brand-button px-7 py-3 text-sm font-semibold uppercase tracking-wider text-brand-ink transition-colors hover:bg-brand-active"
            >
              Start Trading
            </a>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
