import { ArrowRight, BookOpen, Shield, Star } from "lucide-react";
import Link from "next/link";

const INFO_CARDS = [
  {
    icon: BookOpen,
    title: "How evaluations work",
    body: "Pick a tier, trade against live prices, hit the profit target within drawdown constraints.",
    href: "/start",
    linkLabel: "Start an evaluation",
  },
  {
    icon: Shield,
    title: "Slippage transparency",
    body: "Every fill is priced at oracle mid + size slippage + 2 bps house spread, shown before you submit.",
    href: "/cohort",
    linkLabel: "Learn about the model",
  },
  {
    icon: Star,
    title: "The Genesis credential",
    body: "Pass an evaluation and receive a non-transferable record of your trading performance.",
    href: "/cohort",
    linkLabel: "About the credential",
  },
] as const;

export function InfoCardsRow() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      {INFO_CARDS.map((card) => {
        const Icon = card.icon;
        return (
          <div
            key={card.title}
            className="rounded-[var(--radius)] border border-border bg-surface px-4 py-4"
          >
            <div className="mb-3 flex h-8 w-8 items-center justify-center rounded-[var(--radius-sm)] bg-surface-2">
              <Icon className="h-4 w-4 text-text-muted" />
            </div>
            <div className="text-sm font-semibold text-text">{card.title}</div>
            <p className="mt-1 text-xs leading-relaxed text-text-muted">{card.body}</p>
            <Link
              href={card.href}
              className="mt-3 inline-flex items-center gap-1 text-xs text-text-faint transition-colors hover:text-text"
            >
              {card.linkLabel}
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        );
      })}
    </div>
  );
}
