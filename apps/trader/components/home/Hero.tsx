import Link from "next/link";
import { Button } from "@/components/ui";

export function Hero() {
  return (
    <section className="py-16 sm:py-24">
      <div className="max-w-2xl">
        <h1 className="text-balance text-4xl font-semibold leading-[1.08] tracking-tight text-text sm:text-5xl">
          Prove your edge in a live-price evaluation.
        </h1>
        <p className="mt-5 max-w-xl text-pretty text-base leading-relaxed text-text-muted">
          Trade BTC, ETH and SOL in simulation against real market prices. Pass
          the drawdown and profit-target rules, and earn your Genesis credential.
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <Link href="/start">
            <Button variant="primary" size="lg">
              Start an evaluation
            </Button>
          </Link>
          <Link href="/leaderboard">
            <Button variant="ghost" size="lg">
              View leaderboard
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
}
