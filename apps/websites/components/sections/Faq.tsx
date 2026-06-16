"use client";

import { Minus, Plus } from "lucide-react";
import { useState } from "react";

const FAQ: { q: string; a: React.ReactNode }[] = [
  {
    q: "What is Ultraprop?",
    a: (
      <>
        <p>
          Ultraprop is a proprietary trading firm. You trade perpetuals on
          crypto, indices and commodities against live market prices in a fully
          simulated account, with the fill math shown before every order.
        </p>
        <p className="mt-3">
          Clear the evaluation and you trade a funded account on the firm&apos;s
          capital. Key features:
        </p>
        <ul className="mt-3 list-disc space-y-1.5 pl-5 text-text-muted">
          <li>
            <span className="font-medium text-text">No deposit:</span> you never
            risk your own money.
          </li>
          <li>
            <span className="font-medium text-text">Leverage:</span> trade with
            up to 200x in simulation.
          </li>
          <li>
            <span className="font-medium text-text">Assets:</span> crypto, FX,
            commodities and global index perpetuals.
          </li>
          <li>
            <span className="font-medium text-text">Transparency:</span> fills,
            fees and slippage are shown up front.
          </li>
        </ul>
      </>
    ),
  },
  {
    q: "How is Ultraprop different from a broker?",
    a: (
      <p>
        There is no custody of your funds and nothing to deposit. You qualify on
        skill, not capital. Pass the evaluation and trade the firm&apos;s
        balance. Pricing, fees and rules are the same for everyone and visible
        before you place an order.
      </p>
    ),
  },
  {
    q: "I'm a perps trader. Why should I use Ultraprop?",
    a: (
      <p>
        Trade crypto, indices and commodities from a single account against the
        same live prices you already follow, then turn a consistent track record
        into funded size without putting your own balance at risk.
      </p>
    ),
  },
  {
    q: "What do I need to start trading on Ultraprop?",
    a: (
      <p>
        Just an account. There is no wallet to fund and no minimum balance.
        Sign up, pick your evaluation, and start placing simulated orders against
        live market data right away.
      </p>
    ),
  },
  {
    q: "Do I control my evaluation account?",
    a: (
      <p>
        Yes. Your simulated balance, positions and history are yours to manage.
        Trades settle against live prices and nothing is gated behind manual
        intervention.
      </p>
    ),
  },
  {
    q: "Can I redeem positions for the underlying assets?",
    a: (
      <p>
        No. Every market is a perpetual that mirrors the price of its
        underlying, so you get the exposure without ever holding the physical
        asset.
      </p>
    ),
  },
  {
    q: "What does an evaluation cost?",
    a: (
      <p>
        Evaluation pricing depends on the account size you target. The full fee
        and payout breakdown is listed before you start, with no surprises after
        you fund.
      </p>
    ),
  },
];

function Item({
  item,
  open,
  onToggle,
}: {
  item: (typeof FAQ)[number];
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="border-b border-border-soft">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-4 py-6 text-left"
      >
        <span className="text-lg text-text">{item.q}</span>
        <span className="shrink-0 text-text-faint">
          {open ? <Minus className="size-5" /> : <Plus className="size-5" />}
        </span>
      </button>
      {open && (
        <div className="rise-in max-w-3xl pb-6 text-sm leading-relaxed text-text-muted">
          {item.a}
        </div>
      )}
    </div>
  );
}

export function Faq() {
  const [open, setOpen] = useState(0);

  return (
    <section id="faq" className="py-24 sm:py-28">
      <div className="mx-auto max-w-3xl px-5 sm:px-8">
        <h2 className="mb-10 text-center text-4xl font-normal sm:text-5xl">
          Frequently Asked Questions
        </h2>
        <div>
          {FAQ.map((item, i) => (
            <Item
              key={item.q}
              item={item}
              open={open === i}
              onToggle={() => setOpen(open === i ? -1 : i)}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
