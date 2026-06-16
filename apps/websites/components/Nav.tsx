"use client";

import { ChevronDown } from "lucide-react";
import { useEffect, useState } from "react";
import { Logo } from "@/components/Logo";
import { external, links } from "@/lib/links";
import { cn } from "@/lib/utils";

const NAV_GROUPS: {
  label: string;
  items: { label: string; href: string }[];
}[] = [
  {
    label: "Product",
    items: [
      { label: "Trade", href: links.app },
      { label: "Evaluations", href: links.app },
      { label: "Funding", href: links.app },
    ],
  },
  {
    label: "Insights",
    items: [
      { label: "Blog", href: links.blog },
      { label: "Market Outlook", href: links.blog },
    ],
  },
];

export function Nav() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 16);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 transition-colors duration-300",
        scrolled
          ? "border-b border-border/70 bg-bg/80 backdrop-blur-xl"
          : "border-b border-transparent",
      )}
    >
      <div className="mx-auto flex h-16 max-w-[1200px] items-center justify-between gap-6 px-5 sm:px-8">
        <div className="flex items-center gap-8">
          <a href={links.home} className="flex items-center" aria-label="Ultraprop home">
            <Logo size={22} />
          </a>
          <nav className="hidden items-center gap-1 md:flex">
            {NAV_GROUPS.map((group) => (
              <div key={group.label} className="group relative">
                <button
                  type="button"
                  className="flex items-center gap-1 rounded-md px-3 py-2 text-sm font-medium text-text-muted transition-colors hover:text-text"
                >
                  {group.label}
                  <ChevronDown className="size-3.5 opacity-60 transition-transform group-hover:rotate-180" />
                </button>
                <div className="invisible absolute left-0 top-full w-48 translate-y-1 pt-2 opacity-0 transition-all duration-150 group-hover:visible group-hover:translate-y-0 group-hover:opacity-100">
                  <div className="rounded-xl border border-border bg-surface p-1.5 shadow-2xl shadow-black/40">
                    {group.items.map((item) => (
                      <a
                        key={item.label}
                        href={item.href}
                        {...external}
                        className="block rounded-lg px-3 py-2 text-sm text-text-muted transition-colors hover:bg-surface-2 hover:text-text"
                      >
                        {item.label}
                      </a>
                    ))}
                  </div>
                </div>
              </div>
            ))}
            <a
              href={links.docs}
              {...external}
              className="rounded-md px-3 py-2 text-sm font-medium text-text-muted transition-colors hover:text-text"
            >
              Docs
            </a>
            <a
              href={links.x}
              {...external}
              className="rounded-md px-3 py-2 text-sm font-medium text-text-muted transition-colors hover:text-text"
            >
              Community
            </a>
          </nav>
        </div>

        <a
          href={links.app}
          {...external}
          className="rounded-lg bg-brand px-4 py-2 text-xs font-semibold uppercase tracking-wider text-brand-ink transition-colors hover:bg-brand-hover"
        >
          Launch App
        </a>
      </div>
    </header>
  );
}
