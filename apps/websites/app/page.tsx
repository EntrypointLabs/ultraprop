import { Logo } from "@/components/Logo";
import { SiteFooter } from "@/components/SiteFooter";
import { external, links } from "@/lib/links";

// Self-hosted to avoid hotlink throttling. Source: Unsplash (free license),
// photo-1464822759023-fed622ff2c3b (mountain valley). A bright daytime shot,
// pushed to a dark red duotone in CSS so it reads as a moody, branded scene.
const BG_IMAGE = "/footer-backdrop.jpg";

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
            <span className="text-brand">Prove your edge.</span>
            <br />
            Earn a funded account.
          </h1>
          <p className="hero-in hero-in-2 mt-6 max-w-lg text-pretty text-text-muted">
            Trade the full Bluefin, DeepBook &amp; Hyperliquid perpetual catalog
            in simulation against live market prices. Clear the evaluation to
            earn a funded account, your track record recorded on-chain.
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

        <SiteFooter />
      </div>
    </div>
  );
}
