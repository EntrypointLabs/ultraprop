"use client";

import {
  Activity,
  AlertTriangle,
  ArrowUpDown,
  CheckCircle2,
  ChevronDown,
  Clock,
  Info,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import * as React from "react";
import {
  AssetIcon,
  Button,
  CardLabel,
  Input,
  Modal,
  Tooltip,
} from "@/components/ui";
import {
  useConnection,
  useDivergenceHalt,
  useMarketCatalog,
  usePrice,
  useSession,
  useVault,
} from "@/lib/mock/hooks";
import { DEFAULT_MARKET_ID, MARKET_IDS } from "@/lib/mock/markets";
import { useMockStore } from "@/lib/mock/store";
import type { MarketId, Side, VaultState } from "@/lib/mock/types";
import { drawdownCappedLiquidation, liquidationPrice } from "@/lib/sim/engine";
import { HL_TAKER_BPS, slippagePreview } from "@/lib/slippage-preview";
import { isSuiConfigured } from "@/lib/sui/config";
import { usdcToUsd } from "@/lib/sui/propfirm";
import { useOnchainAccountSummary } from "@/lib/sui/useTradingAccount";
import { cn, formatNum, formatUsd, formatUsdOrDash } from "@/lib/utils";

type MarginMode = "isolated" | "cross";

/* -------------------------------------------------------------------------- */
/* Local types                                                                  */
/* -------------------------------------------------------------------------- */

interface TradeIntentFormProps {
  vaultId: string;
  marketId?: MarketId;
  onMarketChange?: (id: MarketId) => void;
  onSubmitOrder?: (intent: {
    symbol: MarketId;
    side: Side;
    sizeUsd: number;
    marginMode: MarginMode;
    leverage: number;
    takeProfit?: number | null;
    stopLoss?: number | null;
  }) => void;
  isGuestAllowed?: boolean;
  initialSide?: Side;
}

type SubmitState =
  | { phase: "idle" }
  | { phase: "submitting" }
  | {
      phase: "confirmed";
      symbol: MarketId;
      side: Side;
      fill: number;
      sizeUsd: number;
      ts: number;
    }
  | { phase: "error"; message: string };

/* -------------------------------------------------------------------------- */
/* TP/SL preset configurations                                                  */
/* -------------------------------------------------------------------------- */

const TP_PRESETS = [25, 50, 75, 100, 500, 900] as const;
const SL_PRESETS = [5, 10, 25, 50, 75] as const;

/* -------------------------------------------------------------------------- */
/* Uncontrolled symbol tab (secondary — only rendered without a marketId prop) */
/* -------------------------------------------------------------------------- */

function SymbolTab({
  symbol,
  active,
  onClick,
}: {
  symbol: MarketId;
  active: boolean;
  onClick: () => void;
}) {
  const tick = usePrice(symbol);
  const price = tick?.markPx ?? null;
  const change = tick?.change24h ?? null;
  const up = (change ?? 0) >= 0;

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "flex flex-1 flex-col items-center gap-0.5 rounded-[var(--radius-sm)] px-2 py-2 transition-colors",
        active
          ? "bg-surface-3 text-text"
          : "text-text-muted hover:bg-surface-2 hover:text-text",
      )}
    >
      <div className="flex items-center gap-1.5">
        <AssetIcon symbol={symbol} size={16} />
        <span className="text-sm font-semibold">{symbol}</span>
      </div>
      <span
        className={cn(
          "tabular text-xs",
          price == null ? "text-text-faint" : up ? "text-up" : "text-down",
        )}
      >
        {formatUsdOrDash(price, { decimals: (price ?? 0) > 100 ? 0 : 2 })}
      </span>
    </button>
  );
}

/* -------------------------------------------------------------------------- */
/* Side toggle: Long / Short — each shows its live mark price                   */
/* -------------------------------------------------------------------------- */

function SideToggle({
  value,
  onValueChange,
  symbol,
}: {
  value: Side;
  onValueChange: (v: Side) => void;
  symbol: MarketId;
}) {
  const tick = usePrice(symbol);
  const markPx = tick?.markPx ?? null;

  const priceLabel =
    markPx != null
      ? formatUsd(markPx, { decimals: markPx > 100 ? 1 : 4 })
      : null;

  return (
    <div className="grid grid-cols-2 gap-1.5">
      <button
        type="button"
        aria-pressed={value === "long"}
        onClick={() => onValueChange("long")}
        className={cn(
          "flex flex-col items-start gap-0.5 rounded-[var(--radius-sm)] border px-3 py-2.5 transition-colors",
          value === "long"
            ? "border-up bg-up/15"
            : "border-border bg-transparent hover:border-up/40",
        )}
      >
        <span
          className={cn(
            "text-sm font-semibold",
            value === "long" ? "text-up" : "text-text-muted",
          )}
        >
          Long
        </span>
        {priceLabel != null && (
          <span
            className={cn(
              "tabular text-base font-semibold leading-none",
              value === "long" ? "text-up" : "text-text-faint",
            )}
          >
            {priceLabel}
          </span>
        )}
      </button>
      <button
        type="button"
        aria-pressed={value === "short"}
        onClick={() => onValueChange("short")}
        className={cn(
          "flex flex-col items-start gap-0.5 rounded-[var(--radius-sm)] border px-3 py-2.5 transition-colors",
          value === "short"
            ? "border-down bg-down/15"
            : "border-border bg-transparent hover:border-down/40",
        )}
      >
        <span
          className={cn(
            "text-sm font-semibold",
            value === "short" ? "text-down" : "text-text-muted",
          )}
        >
          Short
        </span>
        {priceLabel != null && (
          <span
            className={cn(
              "tabular text-base font-semibold leading-none",
              value === "short" ? "text-down" : "text-text-faint",
            )}
          >
            {priceLabel}
          </span>
        )}
      </button>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Leverage selector: slider + preset pills capped to the effective max        */
/* -------------------------------------------------------------------------- */

function LeverageSelector({
  value,
  cap,
  onValueChange,
  marginMode,
  onMarginModeChange,
  forcedIsolated,
}: {
  value: number;
  cap: number;
  onValueChange: (v: number) => void;
  marginMode: MarginMode;
  onMarginModeChange: (v: MarginMode) => void;
  forcedIsolated: boolean;
}) {
  const clamp = (n: number) => Math.max(1, Math.min(cap, Math.round(n)));
  // Quick-pick anchors spread across the usable range — 1×, a quarter, half,
  // three-quarters, and the cap — so a low-cap tier still gets useful mid-points
  // instead of just 1× and the max (cap 10 → 1 / 3 / 5 / 8 / 10).
  const visiblePresets = React.useMemo(() => {
    const pts = [
      1,
      Math.round(cap / 4),
      Math.round(cap / 2),
      Math.round((cap * 3) / 4),
      cap,
    ];
    return [...new Set(pts)]
      .filter((v) => v >= 1 && v <= cap)
      .sort((a, b) => a - b);
  }, [cap]);

  return (
    <div className="flex flex-col gap-2">
      {/* Row: label + value + margin mode inline */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs text-text-faint">Leverage</span>
          {/* Compact margin mode — two tiny pills inline with the label */}
          <div className="flex items-center rounded-[var(--radius-sm)] border border-border bg-surface p-0.5">
            {(["cross", "isolated"] as MarginMode[]).map((mode) => {
              const active = marginMode === mode;
              const disabled = forcedIsolated && mode === "cross";
              return (
                <button
                  key={mode}
                  type="button"
                  aria-pressed={active}
                  disabled={disabled}
                  onClick={() => onMarginModeChange(mode)}
                  className={cn(
                    "rounded-sm px-1.5 py-0.5 text-[10px] font-semibold capitalize transition-colors",
                    active
                      ? "bg-surface-3 text-text"
                      : "text-text-faint hover:text-text-muted",
                    disabled && "cursor-not-allowed opacity-30",
                  )}
                >
                  {mode}
                </button>
              );
            })}
          </div>
        </div>
        <span className="tabular text-base font-bold text-text">{value}×</span>
      </div>

      {/* Slider */}
      <input
        type="range"
        min={1}
        max={cap}
        step={1}
        value={value}
        onChange={(e) => onValueChange(clamp(Number(e.target.value)))}
        aria-label="Leverage"
        className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-surface-3 accent-brand"
      />

      {/* Preset pills */}
      <div className="flex gap-1">
        {visiblePresets.map((preset) => (
          <button
            key={preset}
            type="button"
            onClick={() => onValueChange(preset)}
            className={cn(
              "flex-1 rounded-[var(--radius-sm)] border py-1.5 text-xs font-medium transition-colors",
              value === preset
                ? "border-border-soft bg-surface-3 text-text"
                : "border-border bg-transparent text-text-faint hover:border-border-soft hover:text-text-muted",
            )}
          >
            {preset}×
          </button>
        ))}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* TP/SL collapsible section                                                    */
/* -------------------------------------------------------------------------- */

interface TpSlState {
  tpPrice: string;
  tpPct: string;
  slPrice: string;
  slPct: string;
}

function TpSlSection({
  state,
  onChange,
  side,
  entry,
  leverage,
  collateral,
}: {
  state: TpSlState;
  onChange: (next: Partial<TpSlState>) => void;
  side: Side;
  entry: number | null;
  leverage: number;
  collateral: number;
}) {
  const [open, setOpen] = React.useState(false);

  // price → % and % → price conversion helpers
  const priceFromPct = React.useCallback(
    (pct: number, leg: "tp" | "sl"): number | null => {
      if (!entry || entry <= 0 || leverage <= 0) return null;
      const direction = leg === "tp" ? 1 : -1;
      const sign = side === "long" ? direction : -direction;
      return entry * (1 + (sign * pct) / (leverage * 100));
    },
    [entry, leverage, side],
  );

  const pctFromPrice = React.useCallback(
    (price: number, leg: "tp" | "sl"): number | null => {
      if (!entry || entry <= 0 || leverage <= 0) return null;
      const direction = leg === "tp" ? 1 : -1;
      const sign = side === "long" ? direction : -direction;
      return ((price / entry - 1) / sign) * leverage * 100;
    },
    [entry, leverage, side],
  );

  const handleTpPrice = (raw: string) => {
    const price = parseFloat(raw);
    if (raw === "" || !Number.isFinite(price)) {
      onChange({ tpPrice: raw, tpPct: "" });
      return;
    }
    const pct = pctFromPrice(price, "tp");
    onChange({
      tpPrice: raw,
      tpPct: pct != null && pct > 0 ? pct.toFixed(1) : "",
    });
  };

  const handleTpPct = (raw: string) => {
    const pct = parseFloat(raw);
    if (raw === "" || !Number.isFinite(pct)) {
      onChange({ tpPct: raw, tpPrice: "" });
      return;
    }
    const price = priceFromPct(pct, "tp");
    onChange({
      tpPct: raw,
      tpPrice:
        price != null && price > 0 ? price.toFixed(price > 100 ? 2 : 4) : "",
    });
  };

  const handleSlPrice = (raw: string) => {
    const price = parseFloat(raw);
    if (raw === "" || !Number.isFinite(price)) {
      onChange({ slPrice: raw, slPct: "" });
      return;
    }
    const pct = pctFromPrice(price, "sl");
    onChange({
      slPrice: raw,
      slPct: pct != null && pct > 0 ? pct.toFixed(1) : "",
    });
  };

  const handleSlPct = (raw: string) => {
    const pct = parseFloat(raw);
    if (raw === "" || !Number.isFinite(pct)) {
      onChange({ slPct: raw, slPrice: "" });
      return;
    }
    const price = priceFromPct(pct, "sl");
    onChange({
      slPct: raw,
      slPrice:
        price != null && price > 0 ? price.toFixed(price > 100 ? 2 : 4) : "",
    });
  };

  const applyTpPreset = (pct: number) => {
    const price = priceFromPct(pct, "tp");
    onChange({
      tpPct: String(pct),
      tpPrice:
        price != null && price > 0 ? price.toFixed(price > 100 ? 2 : 4) : "",
    });
  };

  const applySlPreset = (pct: number | null) => {
    if (pct === null) {
      onChange({ slPct: "", slPrice: "" });
      return;
    }
    const price = priceFromPct(pct, "sl");
    onChange({
      slPct: String(pct),
      slPrice:
        price != null && price > 0 ? price.toFixed(price > 100 ? 2 : 4) : "",
    });
  };

  const tpPctNum = parseFloat(state.tpPct);
  const slPctNum = parseFloat(state.slPct);
  const hasTP = Number.isFinite(tpPctNum) && tpPctNum > 0;
  const hasSL = Number.isFinite(slPctNum) && slPctNum > 0;

  const maxProfit = hasTP ? collateral * (tpPctNum / 100) : null;
  const maxLoss = hasSL ? collateral * (slPctNum / 100) : null;

  const activeTpPreset = hasTP
    ? (TP_PRESETS.find((p) => p === tpPctNum) ?? null)
    : null;
  const activeSlPreset = hasSL
    ? (SL_PRESETS.find((p) => p === slPctNum) ?? null)
    : null;

  return (
    <div className="rounded-[var(--radius)] border border-border bg-surface-2 overflow-hidden">
      {/* Header row — always visible */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-3 py-3 transition-colors hover:bg-surface-3"
        aria-expanded={open}
      >
        <span className="flex items-center gap-1.5 text-sm">
          <span className="text-text-muted">TP</span>
          <span
            className={cn(
              "tabular",
              hasTP ? "font-semibold text-up" : "text-text-faint",
            )}
          >
            {hasTP ? `${tpPctNum}%` : "None"}
          </span>
          <span className="text-text-faint">/</span>
          <span className="text-text-muted">SL</span>
          <span
            className={cn(
              "tabular",
              hasSL ? "font-semibold text-down" : "text-text-faint",
            )}
          >
            {hasSL ? `${slPctNum}%` : "None"}
          </span>
        </span>
        <ChevronDown
          className={cn(
            "h-4 w-4 text-text-faint transition-transform duration-200",
            open && "rotate-180",
          )}
        />
      </button>

      {/* Expandable body */}
      {open && (
        <div className="flex flex-col gap-3 border-t border-border px-3 pb-3 pt-3">
          {/* Take profit */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs text-text-faint">Take Profit</span>
              {maxProfit != null && (
                <span className="tabular text-xs font-medium text-up">
                  Max Profit: {formatUsd(maxProfit, { decimals: 2 })}
                </span>
              )}
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              <Input
                mono
                type="number"
                min={0}
                step="any"
                value={state.tpPrice}
                onChange={(e) => handleTpPrice(e.target.value)}
                placeholder="Price"
                aria-label="Take profit price"
                className="h-8 text-xs"
              />
              <Input
                mono
                type="number"
                min={0}
                step="any"
                value={state.tpPct}
                onChange={(e) => handleTpPct(e.target.value)}
                placeholder="Gain %"
                aria-label="Take profit percentage"
                className="h-8 text-xs"
              />
            </div>
            <div className="flex gap-1">
              {TP_PRESETS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => applyTpPreset(p)}
                  className={cn(
                    "flex-1 rounded-sm border py-0.5 text-[10px] font-medium transition-colors",
                    activeTpPreset === p
                      ? "border-up/50 bg-up/15 text-up"
                      : "border-border bg-transparent text-text-faint hover:border-border-soft hover:text-text-muted",
                  )}
                >
                  {p}%
                </button>
              ))}
            </div>
          </div>

          {/* Stop loss */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs text-text-faint">Stop Loss</span>
              {maxLoss != null && (
                <span className="tabular text-xs font-medium text-down">
                  Max Loss: {formatUsd(maxLoss, { decimals: 2 })}
                </span>
              )}
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              <Input
                mono
                type="number"
                min={0}
                step="any"
                value={state.slPrice}
                onChange={(e) => handleSlPrice(e.target.value)}
                placeholder="Price"
                aria-label="Stop loss price"
                className="h-8 text-xs"
              />
              <Input
                mono
                type="number"
                min={0}
                step="any"
                value={state.slPct}
                onChange={(e) => handleSlPct(e.target.value)}
                placeholder="Loss %"
                aria-label="Stop loss percentage"
                className="h-8 text-xs"
              />
            </div>
            <div className="flex gap-1">
              {SL_PRESETS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => applySlPreset(p)}
                  className={cn(
                    "flex-1 rounded-sm border py-0.5 text-[10px] font-medium transition-colors",
                    activeSlPreset === p
                      ? "border-down/50 bg-down/15 text-down"
                      : "border-border bg-transparent text-text-faint hover:border-border-soft hover:text-text-muted",
                  )}
                >
                  {p}%
                </button>
              ))}
              <button
                type="button"
                onClick={() => applySlPreset(null)}
                className={cn(
                  "flex-1 rounded-sm border py-0.5 text-[10px] font-medium transition-colors",
                  !hasSL
                    ? "border-border-soft bg-surface-3 text-text-muted"
                    : "border-border bg-transparent text-text-faint hover:border-border-soft hover:text-text-muted",
                )}
              >
                None
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Disclosure row — Ostium-style dense two-column label/value                   */
/* -------------------------------------------------------------------------- */

function DisclosureRow({
  label,
  value,
  info,
  warn,
  highlight,
  labelExtra,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  /** Dotted underline on the label — Ostium's "has a tooltip" affordance. */
  info?: boolean;
  warn?: boolean;
  highlight?: boolean;
  labelExtra?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-2 py-1">
      <span className="flex items-center gap-1 text-xs text-text-faint">
        <span
          className={cn(info && "border-b border-dotted border-text-faint/50")}
        >
          {label}
        </span>
        {labelExtra}
      </span>
      <span
        className={cn(
          "tabular text-xs",
          warn
            ? "text-warn"
            : highlight
              ? "font-semibold text-text"
              : "text-text-muted",
        )}
      >
        {value}
      </span>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Price info tooltip content                                                   */
/* -------------------------------------------------------------------------- */

function PriceTooltipContent({
  symbol,
  price,
}: {
  symbol: MarketId;
  price: number;
}) {
  const ticker = symbol.includes(":")
    ? (symbol.split(":")[1] ?? symbol)
    : symbol;
  return (
    <div className="flex flex-col gap-1.5 p-1">
      <div className="flex items-center gap-1.5 text-xs font-semibold text-text">
        <Activity className="h-3 w-3 text-brand" />
        Market price · {ticker}/USD
      </div>
      <div className="flex flex-col gap-0.5">
        <div className="flex justify-between gap-6 text-xs">
          <span className="text-text-muted">Mid price</span>
          <span className="tabular text-text">
            {formatUsd(price, { decimals: 2 })}
          </span>
        </div>
        <div className="flex justify-between gap-6 text-xs">
          <span className="text-text-muted">Taker fee</span>
          <span className="tabular text-warn">{HL_TAKER_BPS} bps</span>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Confirmation flash                                                           */
/* -------------------------------------------------------------------------- */

function ConfirmationFlash({
  symbol,
  side,
  fill,
  sizeUsd,
  onDismiss,
}: {
  symbol: MarketId;
  side: Side;
  fill: number;
  sizeUsd: number;
  onDismiss: () => void;
}) {
  const ticker = symbol.includes(":")
    ? (symbol.split(":")[1] ?? symbol)
    : symbol;
  React.useEffect(() => {
    const t = setTimeout(onDismiss, 4500);
    return () => clearTimeout(t);
  }, [onDismiss]);

  return (
    <div className="flex items-start gap-3 rounded-[var(--radius-sm)] border border-up/30 bg-up/10 px-4 py-3">
      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-up" />
      <div className="flex flex-col gap-0.5">
        <p className="text-sm font-semibold text-up">Order submitted</p>
        <p className="text-xs text-text-muted">
          <span
            className={cn(
              "font-medium",
              side === "long" ? "text-up" : "text-down",
            )}
          >
            {side === "long" ? "Long" : "Short"}
          </span>{" "}
          {ticker} ·{" "}
          <span className="tabular">{formatUsd(sizeUsd, { decimals: 0 })}</span>{" "}
          at <span className="tabular">{formatUsd(fill, { decimals: 2 })}</span>
        </p>
      </div>
      <button
        type="button"
        onClick={onDismiss}
        className="ml-auto shrink-0 text-text-faint transition-colors hover:text-text"
        aria-label="Dismiss"
      >
        ×
      </button>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Rate-limit countdown pill                                                    */
/* -------------------------------------------------------------------------- */

function RateLimitBanner({ until }: { until: number }) {
  const [remaining, setRemaining] = React.useState(
    Math.max(0, until - Date.now()),
  );

  React.useEffect(() => {
    const id = setInterval(() => {
      setRemaining(Math.max(0, until - Date.now()));
    }, 100);
    return () => clearInterval(id);
  }, [until]);

  const secs = Math.ceil(remaining / 1000);

  return (
    <div className="flex items-center gap-2 rounded-[var(--radius-sm)] border border-warn/30 bg-warn/10 px-3 py-2">
      <Clock className="h-3.5 w-3.5 shrink-0 text-warn" />
      <span className="text-xs text-warn">
        Rate limit · next order in{" "}
        <span className="tabular font-semibold">{secs}s</span>
      </span>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Disabled reason banner                                                       */
/* -------------------------------------------------------------------------- */

function DisabledBanner({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-2 rounded-[var(--radius-sm)] border border-down/30 bg-down/10 px-3 py-2">
      <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-down" />
      <span className="text-xs text-down">{message}</span>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Main component                                                               */
/* -------------------------------------------------------------------------- */

export function TradeIntentForm({
  vaultId,
  marketId: marketIdProp,
  onMarketChange,
  onSubmitOrder,
  isGuestAllowed = false,
  initialSide,
}: TradeIntentFormProps) {
  const vault: VaultState = useVault(vaultId);
  const { halted } = useDivergenceHalt();
  const { session } = useSession();
  const connection = useConnection();
  const openLogin = useMockStore((s) => s.openLogin);
  // The verifiable on-chain account (realized equity + status). Drives the
  // available-balance "max" and the tradeable-status gate. Null for the
  // signed-out demo / unconfigured package, where the engine alone applies.
  const { accountId: onchainAccountId, summary: onchainSummary } =
    useOnchainAccountSummary();

  const isControlled = marketIdProp !== undefined;
  const [symbolInternal, setSymbolInternal] =
    React.useState<MarketId>(DEFAULT_MARKET_ID);
  const symbol = isControlled ? marketIdProp : symbolInternal;
  const setSymbol = isControlled
    ? (onMarketChange ?? (() => {}))
    : setSymbolInternal;

  const [side, setSide] = React.useState<Side>(initialSide ?? "long");
  const [marginMode, setMarginMode] = React.useState<MarginMode>("cross");
  const [leverage, setLeverage] = React.useState(1);
  const [rawSize, setRawSize] = React.useState("1000");
  const [submitState, setSubmitState] = React.useState<SubmitState>({
    phase: "idle",
  });
  const [lastSubmitAt, setLastSubmitAt] = React.useState<number | null>(null);
  const [priceInfoOpen, setPriceInfoOpen] = React.useState(false);
  // Estimated-size unit (Ostium's ⇅ swap): size the position either in the asset
  // (e.g. BTC) or in USD notional. `editingSize` buffers the raw keystrokes while
  // that field is focused so it can be typed freely before re-deriving.
  const [sizeUnit, setSizeUnit] = React.useState<"asset" | "usd">("asset");
  const [editingSize, setEditingSize] = React.useState<string | null>(null);
  const [tpsl, setTpsl] = React.useState<TpSlState>({
    tpPrice: "",
    tpPct: "",
    slPrice: "",
    slPct: "",
  });

  const tick = usePrice(symbol);
  const marketMid = tick?.midPx ?? null;
  const markPx = tick?.markPx ?? null;

  const catalog = useMarketCatalog();
  const market = React.useMemo(
    () => catalog.find((m) => m.id === symbol || m.symbol === symbol),
    [catalog, symbol],
  );
  const effectiveLeverageCap = Math.min(
    market?.maxLeverage ?? vault.tier.leverage,
    vault.tier.leverage,
  );
  const forcedIsolated = market?.onlyIsolated ?? false;

  React.useEffect(() => {
    setLeverage((lev) => Math.max(1, Math.min(effectiveLeverageCap, lev)));
  }, [effectiveLeverageCap]);
  React.useEffect(() => {
    if (forcedIsolated) setMarginMode("isolated");
  }, [forcedIsolated]);

  const effectiveLeverage = Math.max(
    1,
    Math.min(effectiveLeverageCap, leverage),
  );
  const effectiveMode: MarginMode = forcedIsolated ? "isolated" : marginMode;

  // Margin already locked by OPEN positions (engine-tracked). The available
  // balance the new order draws on = the equity basis less this. The basis is
  // the verifiable on-chain REALIZED equity when an account exists, else the
  // engine equity (signed-out demo / unconfigured package).
  const usedMargin = vault.positions.reduce(
    (sum, p) => sum + (p.leverage > 0 ? p.sizeUsd / p.leverage : 0),
    0,
  );
  const equityBasis =
    onchainSummary != null ? usdcToUsd(onchainSummary.equity) : vault.equity;
  const availableBalance = Math.max(0, equityBasis - usedMargin);

  // The size input is COLLATERAL (margin). Its cap is the free balance — you
  // can't post more margin than you hold. The notional it controls is collateral
  // × leverage, so exposure (and how hard the position swings equity) grows with
  // leverage, while the margin you post does not. The cap decrements as open
  // positions lock margin ($10k → open $1k margin → $9k free).
  const maxSize = availableBalance;
  const clampSize = React.useCallback(
    (raw: string): string => {
      if (raw === "") return raw;
      const n = parseFloat(raw);
      if (!Number.isFinite(n)) return raw;
      if (n < 0) return "0";
      if (n > maxSize) return String(maxSize);
      return raw;
    },
    [maxSize],
  );

  // Collateral the trader posts; the position's notional/exposure is that
  // collateral amplified by leverage. Everything downstream (fill, fees,
  // liquidation, realized PnL, the on-chain record) is computed on this notional,
  // so a 10× position swings 10× harder on equity than a 1× one of equal margin.
  const collateral = parseFloat(rawSize) || 0;
  const sizeUsd = collateral * effectiveLeverage;

  const preview = React.useMemo(() => {
    if (sizeUsd <= 0 || marketMid == null || marketMid <= 0) return null;
    return slippagePreview({
      marketId: symbol,
      side,
      sizeUsd,
      oracleMid: marketMid,
    });
  }, [symbol, side, sizeUsd, marketMid]);

  const fundingRate = tick?.fundingRate ?? null;
  const fundingPayer =
    fundingRate == null ? null : fundingRate >= 0 ? "longs pay" : "shorts pay";

  const estLiquidation = React.useMemo(() => {
    if (!preview || sizeUsd <= 0 || !market) return null;
    const maxLev = market.maxLeverage;
    const maint = sizeUsd * (1 / (2 * maxLev));
    const isolatedMargin = sizeUsd / effectiveLeverage;
    const venueLiquidation = liquidationPrice({
      entryPrice: preview.fill,
      sizeUsd,
      side,
      maxLeverage: maxLev,
      marginMode: effectiveMode,
      isolatedMargin,
      accountValue: vault.equity,
      maintMarginRequired: maint,
    });
    // Cap the venue liquidation by the firm's remaining drawdown room: the eval
    // fails (and the position settles) the moment loss hits the max-drawdown or
    // daily-loss floor, so the effective stop is never beyond it.
    const ddRule = vault.rules.find((r) => r.kind === "drawdown");
    const dailyRule = vault.rules.find((r) => r.kind === "dailyLoss");
    return drawdownCappedLiquidation({
      venueLiquidation,
      entryPrice: preview.fill,
      sizeUsd,
      side,
      drawdownBudgetUsd: ddRule
        ? Math.max(0, ddRule.limit - ddRule.current)
        : null,
      dailyLossBudgetUsd: dailyRule
        ? Math.max(0, dailyRule.limit - dailyRule.current)
        : null,
    });
  }, [
    preview,
    sizeUsd,
    market,
    side,
    effectiveMode,
    effectiveLeverage,
    vault.equity,
    vault.rules,
  ]);

  const sizeAsset = markPx != null && markPx > 0 ? sizeUsd / markPx : null;

  /* ------------------------------------------------------------------ */
  /* Disable conditions                                                   */
  /* ------------------------------------------------------------------ */

  const RATE_LIMIT_MS = 2000;
  const rateLimitUntil =
    lastSubmitAt !== null ? lastSubmitAt + RATE_LIMIT_MS : null;
  const isRateLimited = rateLimitUntil !== null && Date.now() < rateLimitUntil;

  const isVaultPaused = vault.status !== "active";
  const isPriceUnavailable = marketMid == null || marketMid <= 0;
  const isFeedStale = halted || connection === "stale";
  const isAuthGated = !session.address && !isGuestAllowed;
  const isSizeInvalid = sizeUsd <= 0;
  const isSubmitting = submitState.phase === "submitting";

  // On-chain tradeable gate — only when the package is actually configured (so
  // unconfigured/dev environments and the signed-out demo keep working off the
  // engine alone). When an on-chain account exists, the chain decides whether
  // orders may be placed: tradeable = Evaluating (0) or Passed (1); Failed (2)
  // and Suspended (3) block placement. A signed-in wallet with no on-chain
  // account yet must finish onboarding before trading.
  const onchainGateActive =
    isSuiConfigured() && !isAuthGated && !isGuestAllowed;
  const onchainStatus = onchainSummary?.statusCode ?? null;
  const isOnchainBlocked =
    onchainGateActive && (onchainStatus === 2 || onchainStatus === 3);
  const needsOnchainAccount = onchainGateActive && onchainAccountId == null;

  // Available balance (engine-tracked margin already locked is netted off the
  // verifiable equity basis above); the new order's required margin can't exceed
  // it. This is the same number the "max" notional derives from.
  const freeMargin = availableBalance;
  const requiredMargin = collateral;
  const isInsufficientMargin = !isSizeInvalid && requiredMargin > freeMargin;

  let disabledReason: string | null = null;
  if (isFeedStale)
    disabledReason = "Market data feed unavailable; trading suspended";
  else if (isPriceUnavailable)
    disabledReason = "Waiting for a live oracle price…";
  else if (isVaultPaused) disabledReason = `Evaluation is ${vault.status}`;
  else if (isOnchainBlocked)
    disabledReason =
      onchainStatus === 2
        ? "Account failed evaluation — trading is closed"
        : "Account suspended on-chain — trading is closed";
  else if (needsOnchainAccount)
    disabledReason = "Finish on-chain account setup to trade";
  else if (isSizeInvalid) disabledReason = "Enter a position size";
  else if (isInsufficientMargin)
    disabledReason = `Insufficient margin — needs ${formatUsd(requiredMargin, { decimals: 0 })}, ${formatUsd(Math.max(0, freeMargin), { decimals: 0 })} free`;
  else if (isRateLimited) disabledReason = null;

  const canSubmit =
    !isAuthGated &&
    !isFeedStale &&
    !isPriceUnavailable &&
    !isVaultPaused &&
    !isOnchainBlocked &&
    !needsOnchainAccount &&
    !isSizeInvalid &&
    !isInsufficientMargin &&
    !isRateLimited &&
    !isSubmitting;

  /* ------------------------------------------------------------------ */
  /* Submit handler                                                       */
  /* ------------------------------------------------------------------ */

  const handleSubmit = React.useCallback(() => {
    if (!canSubmit || !preview) return;
    const capturedSymbol = symbol;
    const capturedSide = side;
    const capturedFill = preview.fill;
    const capturedSize = sizeUsd;
    const capturedMode = effectiveMode;
    const capturedLeverage = effectiveLeverage;

    const tpPrice = parseFloat(tpsl.tpPrice);
    const slPrice = parseFloat(tpsl.slPrice);
    const capturedTp = Number.isFinite(tpPrice) && tpPrice > 0 ? tpPrice : null;
    const capturedSl = Number.isFinite(slPrice) && slPrice > 0 ? slPrice : null;

    setSubmitState({ phase: "submitting" });
    setTimeout(() => {
      onSubmitOrder?.({
        symbol: capturedSymbol,
        side: capturedSide,
        sizeUsd: capturedSize,
        marginMode: capturedMode,
        leverage: capturedLeverage,
        takeProfit: capturedTp,
        stopLoss: capturedSl,
      });
      setSubmitState({
        phase: "confirmed",
        symbol: capturedSymbol,
        side: capturedSide,
        fill: capturedFill,
        sizeUsd: capturedSize,
        ts: Date.now(),
      });
      setLastSubmitAt(Date.now());
      setRawSize("1000");
      setTpsl({ tpPrice: "", tpPct: "", slPrice: "", slPct: "" });
    }, 650);
  }, [
    canSubmit,
    preview,
    symbol,
    side,
    sizeUsd,
    effectiveMode,
    effectiveLeverage,
    tpsl,
    onSubmitOrder,
  ]);

  const dismissConfirmation = React.useCallback(() => {
    setSubmitState({ phase: "idle" });
  }, []);

  const assetSizeLabel =
    sizeAsset == null
      ? "0"
      : sizeAsset < 1
        ? sizeAsset.toFixed(6)
        : formatNum(sizeAsset, 4);
  // Raw (un-grouped) estimated size for the editable field, in the active unit.
  const estSizeRaw =
    sizeUsd <= 0
      ? ""
      : sizeUnit === "asset"
        ? assetSizeLabel
        : String(Math.round(sizeUsd * 100) / 100);

  // Editing the estimated size back-solves the collateral the trader must post,
  // so the whole form keeps deriving from one source: collateral × leverage =
  // notional. Asset input converts through the live mark; USD input is notional.
  const applyEstimatedSize = (raw: string) => {
    setEditingSize(raw);
    const entered = parseFloat(raw);
    if (raw === "" || !Number.isFinite(entered) || entered <= 0) {
      setRawSize("");
      return;
    }
    const notionalUsd =
      sizeUnit === "asset"
        ? markPx != null
          ? entered * markPx
          : null
        : entered;
    if (notionalUsd == null || effectiveLeverage <= 0) return;
    const nextCollateral = notionalUsd / effectiveLeverage;
    setRawSize(clampSize(String(Math.round(nextCollateral * 100) / 100)));
  };

  const displaySymbol =
    market?.symbol ?? (symbol.includes(":") ? symbol.split(":")[1]! : symbol);

  /* ------------------------------------------------------------------ */
  /* Render                                                               */
  /* ------------------------------------------------------------------ */

  return (
    <div className="flex w-full flex-col gap-0 overflow-hidden">
      {/* Header */}
      <div className="flex w-full items-center justify-between border-b border-border px-4 py-3">
        <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">
          New Order
        </span>
        <span className="tabular text-xs text-text-faint">
          {vault.intentCount}/{vault.tier.intentCap} orders
        </span>
      </div>

      <div className="flex flex-col gap-3 p-4">
        {/* Symbol picker — only shown when uncontrolled */}
        {!isControlled && (
          <div>
            <CardLabel className="mb-2 block">Asset</CardLabel>
            <div className="flex gap-1 rounded-[var(--radius)] border border-border bg-surface p-1">
              {MARKET_IDS.map((s) => (
                <SymbolTab
                  key={s}
                  symbol={s}
                  active={symbol === s}
                  onClick={() => setSymbol(s)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Side toggle — shows live mark price per side */}
        <SideToggle value={side} onValueChange={setSide} symbol={symbol} />

        {/* Available to Trade — sits above the order card, Ostium-style */}
        <div className="flex items-center justify-between px-1">
          <span className="border-b border-dotted border-text-faint/50 text-xs text-text-muted">
            Available to Trade
          </span>
          <span className="tabular text-xs text-text-muted">
            {formatNum(availableBalance, 2)} USDC
          </span>
        </div>

        {/* Order card — collateral · estimated size · leverage, each a divided
            section with a big inline value (matching Ostium's order panel). */}
        <div className="overflow-hidden rounded-[var(--radius)] border border-border bg-surface-2">
          {/* Collateral — the margin the trader posts, in USDC */}
          <div className="flex items-center justify-between gap-3 px-3 py-3">
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="text-xs text-text-faint">Collateral</span>
              <input
                inputMode="decimal"
                type="number"
                min={1}
                max={maxSize}
                step={50}
                autoComplete="off"
                value={rawSize}
                onChange={(e) => setRawSize(clampSize(e.target.value))}
                placeholder="0"
                aria-label="Collateral in USDC"
                className="w-full min-w-0 bg-transparent text-3xl font-medium tabular text-text outline-none placeholder:text-text-faint [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              />
            </div>
            <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border bg-surface px-2.5 py-1 text-sm font-semibold text-text">
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-info text-[10px] font-bold text-bg">
                $
              </span>
              USDC
            </span>
          </div>

          {/* Estimated size — editable; back-fills collateral. ⇅ swaps asset ⇄ USD */}
          <div className="flex items-center justify-between gap-3 border-t border-border-soft px-3 py-3">
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="text-xs text-text-faint">Estimated Size</span>
              <input
                inputMode="decimal"
                type="text"
                autoComplete="off"
                value={editingSize !== null ? editingSize : estSizeRaw}
                onChange={(e) => applyEstimatedSize(e.target.value)}
                onBlur={() => setEditingSize(null)}
                placeholder="0"
                aria-label={`Estimated size in ${sizeUnit === "asset" ? displaySymbol : "USD"}`}
                className="w-full min-w-0 bg-transparent text-3xl font-medium tabular text-text outline-none placeholder:text-text-faint"
              />
            </div>
            <button
              type="button"
              onClick={() => {
                setEditingSize(null);
                setSizeUnit((u) => (u === "asset" ? "usd" : "asset"));
              }}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border bg-surface px-2.5 py-1 text-sm font-semibold text-text transition-colors hover:bg-surface-3"
              aria-label="Toggle estimated size unit"
            >
              {sizeUnit === "asset" ? (
                <AssetIcon symbol={symbol} size={16} />
              ) : (
                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-info text-[10px] font-bold text-bg">
                  $
                </span>
              )}
              {sizeUnit === "asset" ? displaySymbol : "USD"}
              <ArrowUpDown className="h-3.5 w-3.5 text-text-faint" />
            </button>
          </div>

          {/* Leverage + inline margin mode */}
          <div className="border-t border-border-soft px-3 py-3">
            <LeverageSelector
              value={effectiveLeverage}
              cap={effectiveLeverageCap}
              onValueChange={setLeverage}
              marginMode={effectiveMode}
              onMarginModeChange={setMarginMode}
              forcedIsolated={forcedIsolated}
            />
          </div>
        </div>

        {/* TP/SL collapsible */}
        <TpSlSection
          state={tpsl}
          onChange={(next) => setTpsl((prev) => ({ ...prev, ...next }))}
          side={side}
          entry={markPx}
          leverage={effectiveLeverage}
          collateral={collateral}
        />

        {/* Status banners */}
        {isRateLimited && rateLimitUntil && (
          <RateLimitBanner until={rateLimitUntil} />
        )}
        {disabledReason && !isRateLimited && !isAuthGated && (
          <DisabledBanner message={disabledReason} />
        )}

        {/* Confirmation flash */}
        {submitState.phase === "confirmed" && (
          <ConfirmationFlash
            symbol={submitState.symbol}
            side={submitState.side}
            fill={submitState.fill}
            sizeUsd={submitState.sizeUsd}
            onDismiss={dismissConfirmation}
          />
        )}

        {/* Submit CTA */}
        <Button
          type="button"
          variant={isAuthGated ? "primary" : side === "long" ? "long" : "short"}
          size="lg"
          disabled={!isAuthGated && !canSubmit}
          onClick={isAuthGated ? openLogin : handleSubmit}
          className="w-full font-bold tracking-wide"
        >
          {isAuthGated ? (
            "Sign in to trade"
          ) : isSubmitting ? (
            <span className="flex items-center gap-2">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
              Submitting…
            </span>
          ) : side === "long" ? (
            <span className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Long {displaySymbol}
              {preview && (
                <span className="tabular opacity-80">
                  @{" "}
                  {formatUsd(preview.fill, {
                    decimals: preview.fill > 100 ? 0 : 2,
                  })}
                </span>
              )}
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <TrendingDown className="h-4 w-4" />
              Short {displaySymbol}
              {preview && (
                <span className="tabular opacity-80">
                  @{" "}
                  {formatUsd(preview.fill, {
                    decimals: preview.fill > 100 ? 0 : 2,
                  })}
                </span>
              )}
            </span>
          )}
        </Button>

        <p className="text-center text-xs text-text-faint">
          Simulated · No real funds · Evaluation account
        </p>

        {/* Order info — plain grouped rows below the button, Ostium-style */}
        {preview && sizeUsd > 0 && (
          <div className="flex flex-col px-1">
            <DisclosureRow
              info
              label="Slippage"
              value={`${formatNum(preview.slippageBps, 2)} bps`}
            />
            <DisclosureRow
              info
              label="Simulated spread"
              value={`${((preview.slippageBps / 10000) * 100).toFixed(4)}%`}
            />

            <div className="my-1.5 border-t border-border-soft" />

            <DisclosureRow
              info
              label="Amount"
              value={
                sizeAsset != null ? `${assetSizeLabel} ${displaySymbol}` : "—"
              }
            />
            <DisclosureRow
              info
              label="Exposure"
              value={formatUsd(sizeUsd, { decimals: 2 })}
            />
            <DisclosureRow
              info
              label="Collateral at Open"
              value={`${formatNum(collateral, 2)} USDC`}
            />
            <DisclosureRow
              info
              label="Liquidation Price"
              value={
                estLiquidation == null || estLiquidation <= 0
                  ? "—"
                  : formatUsd(estLiquidation, { decimals: 2 })
              }
            />
            {effectiveMode === "cross" && estLiquidation != null && (
              <p className="pb-0.5 text-[10px] leading-tight text-text-faint">
                Cross liq tracks account value, not leverage set.
              </p>
            )}

            <div className="my-1.5 border-t border-border-soft" />

            {/* Fees group — the live-fill explainer lives on this header */}
            <div className="flex items-center gap-1 py-1 text-xs font-medium text-text-muted">
              <span className="border-b border-dotted border-text-faint/50">
                Fees
              </span>
              <Tooltip
                content={
                  <PriceTooltipContent
                    symbol={symbol}
                    price={preview.oracleMid}
                  />
                }
                side="top"
              >
                <button
                  type="button"
                  onClick={() => setPriceInfoOpen(true)}
                  className="flex items-center text-text-faint transition-colors hover:text-text-muted"
                  aria-label="Price details"
                >
                  <Info className="h-3 w-3" />
                </button>
              </Tooltip>
            </div>
            <DisclosureRow
              info
              warn
              label="Open"
              value={`${formatUsd(preview.feeUsd, { decimals: 2 })} (${HL_TAKER_BPS} bps)`}
            />
            <DisclosureRow
              info
              warn
              label="Close (est.)"
              value={`~${formatUsd(preview.feeUsd, { decimals: 2 })}`}
            />
            {fundingRate != null && (
              <DisclosureRow
                info
                label="Funding"
                value={`${(fundingRate * 100).toFixed(4)}% · ${fundingPayer}`}
              />
            )}

            <div className="my-1.5 border-t border-border-soft" />

            <DisclosureRow
              highlight
              label="Your fill"
              value={formatUsd(preview.fill, { decimals: 2 })}
            />
          </div>
        )}
      </div>

      {/* Price info modal */}
      <Modal
        open={priceInfoOpen}
        onClose={() => setPriceInfoOpen(false)}
        title="How your fill price is set"
      >
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-brand" />
            <p className="text-sm font-semibold text-text">
              Market price · {displaySymbol}/USD
            </p>
          </div>
          <p className="text-sm text-text-muted">
            All fills are computed from live market prices at the moment you
            submit. Your fill = market price + size impact, and the Hyperliquid
            taker fee is charged separately on the fill notional, disclosed
            before you submit, with no hidden markups.
          </p>
          <div className="rounded-[var(--radius)] border border-border bg-surface-2 p-3">
            <div className="grid grid-cols-2 gap-y-2 text-xs">
              <span className="text-text-muted">Current market price</span>
              <span className="tabular text-text">
                {formatUsdOrDash(marketMid, { decimals: 2 })}
              </span>
              <span className="text-text-muted">Size impact</span>
              <span className="tabular text-text-muted">
                proportional to order size
              </span>
              <span className="text-text-muted">Taker fee</span>
              <span className="tabular text-warn">
                {HL_TAKER_BPS} bps on fill notional
              </span>
            </div>
          </div>
          <div className="rounded-sm border border-border-soft bg-surface px-3 py-2">
            <p className="text-xs text-text-faint">
              For long orders your fill is above market price; for short orders
              it is below. The {HL_TAKER_BPS} bps taker fee is charged on entry
              and again on exit, so a round trip pays it twice.
            </p>
          </div>
        </div>
      </Modal>
    </div>
  );
}
