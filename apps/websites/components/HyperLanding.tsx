import { Children } from "react";
import Image from "next/image";
import { external, links } from "@/lib/links";
import { Logo } from "@/components/Logo";
import { ParticleMesh } from "@/components/ParticleMesh";

const MARKETS = [
  ["BTC", "$104,842", "+2.84%"],
  ["ETH", "$3,412.6", "+1.92%"],
  ["SOL", "$184.28", "+4.16%"],
  ["SUI", "$3.927", "+3.04%"],
  ["HYPE", "$48.365", "+5.21%"],
] as const;

type MarketSymbol = (typeof MARKETS)[number][0];

// Checked-in PNG brand assets: Trust Wallet's maintained registry for
// BTC/ETH/SOL/SUI and Hyperliquid's official brand kit for HYPE.
const MARKET_ICON_SRC: Record<MarketSymbol, string> = {
  BTC: "/token-icons/btc.png",
  ETH: "/token-icons/eth.png",
  SOL: "/token-icons/sol.png",
  SUI: "/token-icons/sui.png",
  HYPE: "/token-icons/hype.png",
};

const APP_LANES = [
  ["Trade", "LIVE PERPETUAL MARKETS"],
  ["Evaluations", "TRANSPARENT RULES"],
  ["Leaderboard", "VERIFIED PERFORMANCE"],
  ["Genesis points", "COHORT REWARDS"],
  ["Trader profile", "PERFORMANCE HISTORY"],
] as const;

const NEWS = [
  ["PRODUCT", "AUG 2026", "Inside UltraProp’s transparent evaluation engine"],
  ["PROTOCOL", "JUL 2026", "How live market inputs become verifiable simulated fills"],
  ["GENESIS", "JUN 2026", "Building a public track record for on-chain traders"],
] as const;

function ArrowIcon({ diagonal = false }: { diagonal?: boolean }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" fill="none">
      <path
        d={diagonal ? "M7 17 17 7M8 7h9v9" : "M5 12h14M13 6l6 6-6 6"}
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function MenuIcon({ close = false }: { close?: boolean }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" fill="none">
      <path
        d={close ? "M6 6l12 12M18 6 6 18" : "M5 7h14M5 12h14M5 17h14"}
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" fill="none">
      <path d="m5 12 4 4L19 6" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
    </svg>
  );
}

function BarChartIcon() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" fill="none">
      <path d="M5 19V9m7 10V5m7 14v-7M3 19h18" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
    </svg>
  );
}

function MarketIcon({ symbol }: { symbol: MarketSymbol }) {
  return (
    <Image
      alt=""
      aria-hidden
      className={`hl-market-icon hl-market-icon-${symbol.toLowerCase()}`}
      height={40}
      src={MARKET_ICON_SRC[symbol]}
      width={40}
    />
  );
}

function FingerprintIcon() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" fill="none">
      <path d="M7.4 18.5c1.5-2.2 1.7-4.4 1.7-6.5a2.9 2.9 0 0 1 5.8 0c0 3.9-.8 7-2.4 9M5 15.6c.5-1.3.7-2.5.7-3.6a6.3 6.3 0 0 1 12.6 0c0 2.7-.3 5.1-1.2 7.3M3.2 11.8a8.8 8.8 0 0 1 17.6.2" stroke="currentColor" strokeLinecap="round" strokeWidth="1.5" />
    </svg>
  );
}

function ChevronIcon() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" fill="none">
      <path d="m7 9 5 5 5-5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
    </svg>
  );
}

function MiniTerminal() {
  return (
    <div className="hl-terminal" aria-hidden="true">
      <div className="hl-terminal-bar">
        <Logo size={13} />
        <div className="hl-terminal-nav">
          <span className="active">Trade</span>
          <span>Markets</span>
          <span>Evaluations</span>
          <span>Leaderboard</span>
        </div>
        <span className="hl-connected"><i /> LIVE</span>
      </div>
      <div className="hl-terminal-body">
        <aside className="hl-market-list">
          <small>MARKETS</small>
          {Children.toArray(MARKETS.map(([symbol, price, change], index) => (
            <div className={index === 0 ? "selected" : ""} key={symbol}>
              <b key="symbol">{symbol}</b>
              <span key="price">{price.replace("$", "")}</span>
              <em key="change">{change}</em>
            </div>
          )))}
        </aside>
        <div className="hl-chart-panel">
          <div className="hl-chart-title">
            <div><span>BTC / USD</span><strong>$104,842.10</strong></div>
            <em>+2.84%</em>
          </div>
          <svg viewBox="0 0 650 280" role="img" aria-label="BTC price chart trending upward">
            <defs>
              <linearGradient id="ultraprop-chart-area" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0" stopColor="#ef434b" stopOpacity=".34" />
                <stop offset="1" stopColor="#ef434b" stopOpacity="0" />
              </linearGradient>
            </defs>
            <g className="hl-chart-grid">
              <path d="M0 48H650M0 104H650M0 160H650M0 216H650" />
              <path d="M108 0V280M216 0V280M324 0V280M432 0V280M540 0V280" />
            </g>
            <path
              className="hl-chart-fill"
              d="M0 238C31 216 49 232 81 205C113 179 129 202 158 176C187 151 210 170 235 147C261 124 279 143 306 106C333 69 357 102 383 82C410 61 431 91 459 63C486 36 508 58 537 39C565 20 584 35 612 13C627 1 640 8 650 2V280H0Z"
            />
            <path
              className="hl-chart-line"
              pathLength="1"
              d="M0 238C31 216 49 232 81 205C113 179 129 202 158 176C187 151 210 170 235 147C261 124 279 143 306 106C333 69 357 102 383 82C410 61 431 91 459 63C486 36 508 58 537 39C565 20 584 35 612 13C627 1 640 8 650 2"
            />
          </svg>
          <div className="hl-position">
            <span>OPEN POSITION</span><b>BTC LONG · 5×</b><em>+$1,248.62</em>
          </div>
        </div>
        <aside className="hl-risk-panel">
          <small>EVALUATION</small>
          <span>ACCOUNT EQUITY</span>
          <strong>$106,248.62</strong>
          <em>+$6,248.62</em>
          <div className="hl-progress">
            <span>Profit target <b>62%</b></span>
            <i><u /></i>
          </div>
          <ul>
            <li><CheckIcon /> Daily loss</li>
            <li><CheckIcon /> Max drawdown</li>
            <li><CheckIcon /> Consistency</li>
          </ul>
          <div className="hl-terminal-control">Close position</div>
        </aside>
      </div>
    </div>
  );
}

function BuilderGraphic() {
  return (
    <div className="hl-builder-graphic" aria-hidden>
      {Children.toArray(Array.from({ length: 8 }, (_, row) => (
        <div className="hl-builder-row" key={row}>
          {Children.toArray(Array.from({ length: 11 }, (_, column) => (
            <i
              key={column}
              style={{
                opacity: Math.max(0.12, 0.9 - Math.abs(column - row * 0.8) * 0.12),
                transform: `translateY(${Math.sin((column + row) * 0.8) * 7}px)`,
              }}
            />
          )))}
        </div>
      )))}
    </div>
  );
}

function OrbitGraphic() {
  return (
    <div className="hl-orbit-graphic" aria-hidden>
      <i className="orbit-a" />
      <i className="orbit-b" />
      <i className="orbit-c" />
      <span><FingerprintIcon /></span>
    </div>
  );
}

function NetworkGraphic() {
  return (
    <svg className="hl-network-graphic" viewBox="0 0 360 260" aria-hidden>
      <g className="network-lines" key="network-lines">
        <path d="M48 127L98 54L176 32L247 72L309 144L252 218L155 232L76 194Z" />
        <path d="M98 54L155 232M176 32L76 194M247 72L48 127M309 144L98 54" />
        <path d="M48 127L176 32L252 218M76 194L247 72L155 232" />
      </g>
      {Children.toArray([
        [48, 127], [98, 54], [176, 32], [247, 72], [309, 144], [252, 218],
        [155, 232], [76, 194], [151, 118], [211, 154], [115, 169], [219, 99],
      ].map(([x, y], index) => <circle cx={x} cy={y} r={index < 8 ? 4 : 3} key={`${x}-${y}`} />))}
    </svg>
  );
}

export function HyperLanding() {
  return (
    <div className="hl-clone" id="top">
      <header className="hl-header">
        <a className="hl-logo-pill" href="#top" aria-label="Ultraprop home">
          <Logo size={19} />
        </a>
        <nav className="hl-desktop-nav" aria-label="Primary navigation">
          <a href="#technology">Technology</a>
          <a href="#about">About</a>
          <a href="#apps">Apps</a>
          <a href="#news">News</a>
        </nav>
        <div className="hl-header-spacer" />
        <div className="hl-desktop-nav hl-nav-actions">
          <a href={links.docs} {...external}>Learn</a>
          <a className="accent" href={links.app} {...external}>Trade</a>
        </div>
        <details className="hl-mobile-menu">
          <summary aria-label="Open navigation"><span className="menu-open"><MenuIcon /></span><span className="menu-close"><MenuIcon close /></span></summary>
          <nav aria-label="Mobile navigation">
            <a href="#top">Home</a>
            <a href="#technology">Technology</a>
            <a href="#about">About</a>
            <a href="#apps">Apps</a>
            <a href="#news">News</a>
            <a href={links.app} {...external}>Trade <ArrowIcon diagonal /></a>
          </nav>
        </details>
      </header>

      <main>
        <section className="hl-hero">
          <div className="hl-hero-copy">
            <h1>Prove Your Edge.<br />Trade Funded.</h1>
            <p>
              Trade crypto perpetuals against live on-chain prices, clear a
              transparent evaluation, and earn a funded account.
            </p>
            <a className="hl-button accent" href={links.app} {...external}>
              Start trading <ArrowIcon diagonal />
            </a>
          </div>
        </section>

        <section className="hl-mesh-section" aria-label="Animated market signal terrain">
          <ParticleMesh />
        </section>

        <section className="hl-stats" aria-label="Ultraprop platform details">
          <div><b>1</b><span>MARKET VENUE</span></div>
          <div><b>24 / 7</b><span>MARKET ACCESS</span></div>
          <div><b>LIVE</b><span>PRICE INPUTS</span></div>
          <div><b>VISIBLE</b><span>RULES &amp; LIMITS</span></div>
        </section>

        <section className="hl-product-rail" id="apps">
          <div className="hl-product-mark" aria-hidden><BarChartIcon /></div>
          <span className="hl-eyebrow">TRADE EVERYTHING IN ONE PLACE</span>
          <h2>
            Trade BTC, ETH, SOL, SUI, HYPE, and more from a single evaluation
            with markets that never close.
          </h2>
          <a className="hl-button accent" href={links.app} {...external}>Trade <ArrowIcon diagonal /></a>

          <div className="hl-market-strip" aria-label="Available markets">
            {Children.toArray(MARKETS.map(([symbol]) => (
              <span key={symbol}><i key="mark"><MarketIcon symbol={symbol} /></i><b key="symbol">{symbol}</b></span>
            )))}
          </div>

          <div className="hl-app-scene">
            <div className="hl-app-scenery" aria-hidden />
            <MiniTerminal />
          </div>

          <div className="hl-app-lanes">
            <span className="hl-eyebrow">ULTRAPROP APPS</span>
            {Children.toArray(APP_LANES.map(([name, description]) => (
              <a href={links.app} {...external} key={name}>
                <span key="name">{name}</span><small key="description">{description}</small><ArrowIcon key="arrow" />
              </a>
            )))}
            <a href={links.app} {...external}>
              <span>All apps</span><small>VIEW THE PLATFORM</small><ArrowIcon diagonal />
            </a>
          </div>

          <div className="hl-builder" id="technology">
            <BuilderGraphic />
            <span className="hl-eyebrow">CREDENTIAL ROADMAP</span>
            <h2>Building toward portable records</h2>
            <p>
              UltraProp is building toward portable, on-chain evaluation
              records. Today, traders can complete live-price simulations with
              visible rules while the credential path is being wired into the
              product.
            </p>
            <a className="hl-button neutral" href={links.docs} {...external}>
              Read the docs <ArrowIcon diagonal />
            </a>
          </div>
        </section>

        <section className="hl-manifesto" id="about">
          <div className="hl-content-rail">
            <OrbitGraphic />
            <div className="hl-manifesto-copy">
              <h3>UltraProp’s vision is to make trading capital open, transparent, and earned.</h3>
              <h3>
                Traditional prop firms ask traders to trust hidden execution,
                discretionary rules, and records that disappear inside private databases.
                On-chain markets give us a cleaner foundation.
              </h3>
              <h3>
                UltraProp evaluates traders against live market prices with rules
                that stay visible. Price inputs, simulated fills, and outcomes are
                designed to be inspected instead of merely promised.
              </h3>
              <h3>The best traders should be able to prove their edge and take that proof with them.</h3>
            </div>
          </div>
        </section>

        <section className="hl-security">
          <div className="hl-content-rail">
            <NetworkGraphic />
            <span className="hl-eyebrow">TRANSPARENCY</span>
            <h2>
              UltraProp is built around verifiable market inputs, explicit risk
              limits, and enforcement that does not move the goalposts.
            </h2>
            <p className="hl-security-lede">
              Every evaluation uses the same visible rule set from first trade to final outcome.
            </p>
            <div className="hl-security-columns">
              <p>
                Market prices currently come through the Hyperliquid
                integration. Before an
                order is submitted, the expected simulated fill and price impact
                are shown, so traders can see the model they are trading against.
              </p>
              <p>
                Risk rules are enforced continuously. Daily loss, maximum
                drawdown, and evaluation status are kept in view. A future
                credential layer is planned to anchor completed evaluation
                records onchain once the recording path is live.
              </p>
            </div>
          </div>
        </section>

        <section className="hl-news" id="news">
          <div className="hl-content-rail">
            <span className="hl-eyebrow">NEWS</span>
            <div className="hl-news-list">
              {Children.toArray(NEWS.map(([source, date, title]) => (
                <a href={links.blog} {...external} key={title}>
                  <span key="meta"><b key="source">{source}</b><small key="date">{date}</small></span>
                  <strong key="title">{title}</strong>
                  <ArrowIcon key="arrow" />
                </a>
              )))}
              <a href={links.blog} {...external}>
                <span><b>READ ALL</b></span><strong /><ArrowIcon diagonal />
              </a>
            </div>
          </div>
        </section>

        <section className="hl-faq">
          <div className="hl-faq-wave" aria-hidden>
            {Children.toArray(Array.from({ length: 58 }, (_, index) => <i key={index} />))}
          </div>
          <div className="hl-faq-inner">
            <span className="hl-eyebrow">FAQ</span>
            <div className="hl-faq-list">
              <details>
                <summary>What is UltraProp?<ChevronIcon /></summary>
                <p>UltraProp is an on-chain proprietary trading firm. Traders clear a simulation-based evaluation against live market prices to become eligible for funded trading.</p>
              </details>
              <details>
                <summary>How does the evaluation work?<ChevronIcon /></summary>
                <p>Choose a tier, trade supported perpetual markets, reach the profit target, and remain inside the stated daily loss and drawdown limits.</p>
              </details>
              <details>
                <summary>Which markets can I trade?<ChevronIcon /></summary>
                <p>UltraProp currently supports perpetual markets available through its Hyperliquid integration.</p>
              </details>
              <details>
                <summary>Will evaluation records be verifiable?<ChevronIcon /></summary>
                <p>Portable on-chain evaluation records are planned. Today, evaluation results remain in the trading app while the recording path is completed.</p>
              </details>
            </div>
          </div>
        </section>

      </main>
    </div>
  );
}
