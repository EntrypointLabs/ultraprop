"use client";

import { useState } from "react";
import { Modal, Pill } from "@/components/ui";
import type { RuleBudget, RuleKind } from "@/lib/mock/types";
import { formatUsd } from "@/lib/utils";

interface RulePillsProps {
  rules: RuleBudget[];
}

const RULE_TITLES: Record<RuleKind, string> = {
  drawdown: "Max Drawdown Rule",
  dailyLoss: "Daily Loss Limit",
  profitTarget: "Profit Target",
  intentCount: "Trade Limit",
};

function ruleValueLabel(rule: RuleBudget): string {
  if (rule.kind === "profitTarget") {
    return `${formatUsd(rule.current)} / ${formatUsd(rule.limit)}`;
  }
  if (rule.unit === "count") {
    return `${rule.current} / ${rule.limit}`;
  }
  return `${formatUsd(rule.current)} used`;
}

function RuleDetail({ rule }: { rule: RuleBudget }) {
  const remaining =
    rule.unit === "count"
      ? `${rule.limit - rule.current} remaining`
      : rule.kind === "profitTarget"
        ? `${formatUsd(rule.limit - rule.current)} to go`
        : `${formatUsd(rule.limit - rule.current)} remaining`;

  return (
    <div className="space-y-4 text-sm">
      <p className="leading-relaxed text-text-muted">{rule.description}</p>
      <div className="rounded-[var(--radius)] border border-border bg-surface-2 p-4">
        <div className="grid grid-cols-2 gap-4">
          {rule.kind !== "profitTarget" && (
            <>
              <div>
                <div className="text-xs uppercase tracking-wide text-text-faint">
                  Used
                </div>
                <div className="tabular mt-0.5 font-semibold text-text">
                  {rule.unit === "count"
                    ? `${rule.current}`
                    : formatUsd(rule.current)}
                </div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wide text-text-faint">
                  Limit
                </div>
                <div className="tabular mt-0.5 font-semibold text-text">
                  {rule.unit === "count"
                    ? `${rule.limit}`
                    : formatUsd(rule.limit)}
                </div>
              </div>
            </>
          )}
          {rule.kind === "profitTarget" && (
            <>
              <div>
                <div className="text-xs uppercase tracking-wide text-text-faint">
                  Gained
                </div>
                <div className="tabular mt-0.5 font-semibold text-up">
                  {formatUsd(rule.current)}
                </div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wide text-text-faint">
                  Target
                </div>
                <div className="tabular mt-0.5 font-semibold text-text">
                  {formatUsd(rule.limit)}
                </div>
              </div>
            </>
          )}
          <div className="col-span-2">
            <div className="text-xs uppercase tracking-wide text-text-faint">
              Status
            </div>
            <div
              className={[
                "mt-0.5 font-medium tabular",
                rule.zone === "safe"
                  ? "text-up"
                  : rule.zone === "warn"
                    ? "text-warn"
                    : "text-down",
              ].join(" ")}
            >
              {rule.zone === "safe"
                ? "Safe"
                : rule.zone === "warn"
                  ? "Approaching limit"
                  : "Near breach"}{" "}
              — {remaining}
            </div>
          </div>
        </div>
      </div>
      <div className="space-y-1">
        <div className="flex justify-between text-xs text-text-faint">
          <span>
            {rule.kind === "profitTarget"
              ? "Progress toward target"
              : "Budget consumed"}
          </span>
          <span className="tabular">{(rule.used * 100).toFixed(1)}%</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-surface-3">
          <div
            className={[
              "h-full rounded-full transition-[width] duration-500",
              rule.zone === "safe"
                ? "bg-up"
                : rule.zone === "warn"
                  ? "bg-warn"
                  : "bg-down",
            ].join(" ")}
            style={{ width: `${(rule.used * 100).toFixed(1)}%` }}
          />
        </div>
      </div>
    </div>
  );
}

export function RulePills({ rules }: RulePillsProps) {
  const [openRule, setOpenRule] = useState<RuleBudget | null>(null);

  return (
    <>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {rules.map((rule) => (
          <Pill
            key={rule.kind}
            label={rule.label}
            value={ruleValueLabel(rule)}
            zone={rule.zone}
            progress={rule.used}
            onClick={() => setOpenRule(rule)}
          />
        ))}
      </div>

      <Modal
        open={openRule !== null}
        onClose={() => setOpenRule(null)}
        title={openRule ? RULE_TITLES[openRule.kind] : ""}
      >
        {openRule && <RuleDetail rule={openRule} />}
      </Modal>
    </>
  );
}
