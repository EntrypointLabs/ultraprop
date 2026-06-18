"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

import { AssetSpotlight } from "./spotlights/AssetSpotlight";
import { CohortSpotlight } from "./spotlights/CohortSpotlight";
import { LeaderboardSpotlight } from "./spotlights/LeaderboardSpotlight";
import { TopTraderSpotlight } from "./spotlights/TopTraderSpotlight";

const SLIDES = [
  { id: "cohort", label: "Cohort" },
  { id: "leaderboard", label: "Leaderboard" },
  { id: "top-trader", label: "Top trader" },
  { id: "btc", label: "BTC" },
  { id: "eth", label: "ETH" },
  { id: "sol", label: "SOL" },
] as const;

type SlideId = (typeof SLIDES)[number]["id"];

function SlideContent({ id }: { id: SlideId }) {
  switch (id) {
    case "leaderboard":
      return <LeaderboardSpotlight />;
    case "top-trader":
      return <TopTraderSpotlight />;
    case "btc":
      return <AssetSpotlight symbol="BTC" />;
    case "eth":
      return <AssetSpotlight symbol="ETH" />;
    case "sol":
      return <AssetSpotlight symbol="SOL" />;
    case "cohort":
      return <CohortSpotlight />;
  }
}

export function HeroCarousel() {
  const [current, setCurrent] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const prefersReducedMotion =
    typeof window !== "undefined"
      ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
      : false;

  const goTo = useCallback((idx: number) => {
    setCurrent((c) => {
      const n = SLIDES.length;
      return ((idx % n) + n) % n;
    });
  }, []);

  const prev = useCallback(() => setCurrent((c) => (c - 1 + SLIDES.length) % SLIDES.length), []);
  const next = useCallback(() => setCurrent((c) => (c + 1) % SLIDES.length), []);

  useEffect(() => {
    if (prefersReducedMotion || isHovered) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }
    intervalRef.current = setInterval(() => {
      setCurrent((c) => (c + 1) % SLIDES.length);
    }, 6000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isHovered, prefersReducedMotion]);

  return (
    <div
      role="region"
      aria-label="Spotlight carousel"
      className="relative flex flex-col rounded-[var(--radius-lg)] border border-border bg-surface overflow-hidden"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Slide content */}
      <div className="flex-1 p-5 min-h-[520px]">
        <SlideContent id={SLIDES[current].id} />
      </div>

      {/* Footer controls */}
      <div className="flex items-center justify-between border-t border-border-soft px-5 py-3">
        {/* Dot pager */}
        <div className="flex items-center gap-1.5" role="tablist" aria-label="Slide navigation">
          {SLIDES.map((slide, i) => (
            <button
              key={slide.id}
              type="button"
              role="tab"
              aria-selected={i === current}
              aria-label={`Go to slide: ${slide.label}`}
              onClick={() => goTo(i)}
              className={cn(
                "h-1.5 rounded-full transition-[width,background-color] duration-200 ease-out focus-visible:outline-2 focus-visible:outline-violet focus-visible:outline-offset-2",
                i === current
                  ? "w-6 bg-violet"
                  : "w-1.5 bg-surface-3 hover:bg-text-faint",
              )}
            />
          ))}
        </div>

        <div className="flex items-center gap-3">
          {/* N of M label */}
          <span className="tabular text-xs text-text-faint select-none">
            {current + 1} / {SLIDES.length}
          </span>

          {/* Prev / next */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              aria-label="Previous slide"
              onClick={prev}
              className="flex h-7 w-7 items-center justify-center rounded-[var(--radius-sm)] text-text-faint transition-colors hover:bg-surface-2 hover:text-text focus-visible:outline-2 focus-visible:outline-violet"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              aria-label="Next slide"
              onClick={next}
              className="flex h-7 w-7 items-center justify-center rounded-[var(--radius-sm)] text-text-faint transition-colors hover:bg-surface-2 hover:text-text focus-visible:outline-2 focus-visible:outline-violet"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
