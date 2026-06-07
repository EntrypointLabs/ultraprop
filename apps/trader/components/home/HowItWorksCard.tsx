import { Card } from "@/components/ui";

const STEPS = [
  {
    n: 1,
    title: "Pick a tier",
    body: "Sign in and open a Starter evaluation account.",
  },
  {
    n: 2,
    title: "Trade with full transparency",
    body: "Every fill shows the market mid, slippage and the 2 bps spread before you submit.",
  },
  {
    n: 3,
    title: "Pass the rules",
    body: "Hit the profit target within the drawdown limits to earn your credential.",
  },
];

export function HowItWorksCard() {
  return (
    <Card className="flex flex-col p-6">
      <h2 className="text-base font-semibold text-text">How it works</h2>
      <ol className="mt-4 flex flex-col gap-4">
        {STEPS.map((s) => (
          <li key={s.n} className="flex gap-3">
            <span className="tabular flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-border text-xs font-semibold text-text-muted">
              {s.n}
            </span>
            <div>
              <div className="text-sm font-medium text-text">{s.title}</div>
              <div className="mt-0.5 text-pretty text-sm leading-relaxed text-text-muted">
                {s.body}
              </div>
            </div>
          </li>
        ))}
      </ol>
    </Card>
  );
}
