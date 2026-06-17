"use client";

import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Info,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import * as React from "react";
import {
  AssetIcon,
  Badge,
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
import type { MarketId, Side, VaultState } from "@/lib/mock/types";
import { liquidationPrice } from "@/lib/sim/engine";
import { HL_TAKER_BPS, slippagePreview } from "@/lib/slippage-preview";
import { cn, formatNum, formatUsd, formatUsdOrDash } from "@/lib/utils";

type MarginMode = "isolated" | "cross";

/* -------------------------------------------------------------------------- */
/* Local types                                                                  */
/* -------------------------------------------------------------------------- */

interface TradeIntentFormProps {
  vaultId: string;
  /** When provided the form is controlled — internal asset tab row is hidden. */
  marketId?: MarketId;
  onMarketChange?: (id: MarketId) => void;
  /** Opens a notional position in the paper-trading engine on confirmed submit. */
  onSubmitOrder?: (intent: {
    symbol: MarketId;
    side: Side;
    sizeUsd: number;
    marginMode: MarginMode;
    leverage: number;
  }) => void;
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
/* Symbol selector tab button (used only when uncontrolled)                    */
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
/* Side toggle: Long / Short                                                    */
/* -------------------------------------------------------------------------- */

function SideToggle({
  value,
  onValueChange,
}: {
  value: Side;
  onValueChange: (v: Side) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-1.5">
      <button
        type="button"
        aria-pressed={value === "long"}
        onClick={() => onValueChange("long")}
        className={cn(
          "flex items-center justify-center gap-2 rounded-[var(--radius-sm)] border py-2.5 text-sm font-semibold transition-colors",
          value === "long"
            ? "border-up bg-up/20 text-on-up"
            : "border-border bg-transparent text-text-muted hover:border-up/40 hover:text-up",
        )}
      >
        <TrendingUp className="h-4 w-4" />
        Long
      </button>
      <button
        type="button"
        aria-pressed={value === "short"}
        onClick={() => onValueChange("short")}
        className={cn(
          "flex items-center justify-center gap-2 rounded-[var(--radius-sm)] border py-2.5 text-sm font-semibold transition-colors",
          value === "short"
            ? "border-down bg-down/20 text-on-down"
            : "border-border bg-transparent text-text-muted hover:border-down/40 hover:text-down",
        )}
      >
        <TrendingDown className="h-4 w-4" />
        Short
      </button>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Margin mode: Cross / Isolated                                                */
/* -------------------------------------------------------------------------- */

function MarginModeToggle({
  value,
  onValueChange,
  forcedIsolated,
}: {
  value: MarginMode;
  onValueChange: (v: MarginMode) => void;
  forcedIsolated: boolean;
}) {
  const modes: MarginMode[] = ["cross", "isolated"];
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <CardLabel>Margin mode</CardLabel>
        {forcedIsolated && (
          <span className="text-xs text-text-faint">Isolated only</span>
        )}
      </div>
      <div className="grid grid-cols-2 gap-1.5 rounded-[var(--radius)] border border-border bg-surface p-1">
        {modes.map((mode) => {
          const active = value === mode;
          const disabled = forcedIsolated && mode === "cross";
          return (
            <button
              key={mode}
              type="button"
              aria-pressed={active}
              disabled={disabled}
              onClick={() => onValueChange(mode)}
              className={cn(
                "rounded-[var(--radius-sm)] py-1.5 text-xs font-semibold capitalize transition-colors",
                active
                  ? "bg-surface-3 text-text"
                  : "text-text-muted hover:bg-surface-2 hover:text-text",
                disabled &&
                  "cursor-not-allowed opacity-40 hover:bg-transparent",
              )}
            >
              {mode}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Leverage selector: slider + stepper bounded to the effective cap            */
/* -------------------------------------------------------------------------- */

function LeverageSelector({
  value,
  cap,
  onValueChange,
}: {
  value: number;
  cap: number;
  onValueChange: (v: number) => void;
}) {
  const clamp = (n: number) => Math.max(1, Math.min(cap, Math.round(n)));
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <CardLabel>Leverage</CardLabel>
        <span className="tabular text-xs text-text-faint">Max {cap}×</span>
      </div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          aria-label="Decrease leverage"
          onClick={() => onValueChange(clamp(value - 1))}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[var(--radius-sm)] border border-border text-text-muted transition-colors hover:border-border-soft hover:text-text"
        >
          −
        </button>
        <input
          type="range"
          min={1}
          max={cap}
          step={1}
          value={value}
          onChange={(e) => onValueChange(clamp(Number(e.target.value)))}
          aria-label="Leverage"
          className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-surface-3 accent-brand"
        />
        <button
          type="button"
          aria-label="Increase leverage"
          onClick={() => onValueChange(clamp(value + 1))}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[var(--radius-sm)] border border-border text-text-muted transition-colors hover:border-border-soft hover:text-text"
        >
          +
        </button>
        <span className="tabular w-10 shrink-0 text-right text-sm font-bold text-text">
          {value}×
        </span>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Slippage breakdown row                                                       */
/* -------------------------------------------------------------------------- */

function SlippageRow({
  label,
  value,
  highlight,
  muted,
  warn,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  highlight?: boolean;
  muted?: boolean;
  warn?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-2 py-1",
        highlight && "border-t border-border-soft pt-2",
      )}
    >
      <span
        className={cn("text-xs", muted ? "text-text-muted" : "text-text-faint")}
      >
        {label}
      </span>
      <span
        className={cn(
          "tabular text-xs font-medium",
          warn ? "text-warn" : highlight ? "text-text" : "text-text-muted",
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
  const ticker = symbol.includes(":") ? (symbol.split(":")[1] ?? symbol) : symbol;
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
  const ticker = symbol.includes(":") ? (symbol.split(":")[1] ?? symbol) : symbol;
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
/* Quick-size preset buttons                                                    */
/* -------------------------------------------------------------------------- */

const SIZE_PRESETS = [250, 500, 1000, 2500] as const;

/* -------------------------------------------------------------------------- */
/* Main component                                                               */
/* -------------------------------------------------------------------------- */

export function TradeIntentForm({
  vaultId,
  marketId: marketIdProp,
  onMarketChange,
  onSubmitOrder,
}: TradeIntentFormProps) {
  const vault: VaultState = useVault(vaultId);
  const { halted } = useDivergenceHalt();
  const { session } = useSession();
  const connection = useConnection();

  const isControlled = marketIdProp !== undefined;
  const [symbolInternal, setSymbolInternal] =
    React.useState<MarketId>(DEFAULT_MARKET_ID);
  const symbol = isControlled ? marketIdProp : symbolInternal;
  const setSymbol = isControlled
    ? (onMarketChange ?? (() => {}))
    : setSymbolInternal;

  const [side, setSide] = React.useState<Side>("long");
  const [marginMode, setMarginMode] = React.useState<MarginMode>("cross");
  const [leverage, setLeverage] = React.useState(1);
  const [rawSize, setRawSize] = React.useState("1000");
  const [submitState, setSubmitState] = React.useState<SubmitState>({
    phase: "idle",
  });
  const [lastSubmitAt, setLastSubmitAt] = React.useState<number | null>(null);
  const [priceInfoOpen, setPriceInfoOpen] = React.useState(false);

  const tick = usePrice(symbol);
  // Fill path: entry/exit prices off mid (mid ± slippage), never mark.
  const marketMid = tick?.midPx ?? null;

  // Effective usable leverage = min(per-market venue cap, tier flat cap). Falls
  // to the market cap when a low-leverage perp's max sits BELOW the tier cap.
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
  // The selected leverage/mode kept inside the venue/tier bounds as the market
  // changes — clamp on overshoot, force isolated where the market requires it.
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

  const sizeUsd = parseFloat(rawSize) || 0;
  // USD-notional order → implied leverage against the tier's shadow allocation.
  const impliedLeverage =
    vault.tier.shadowAllocation > 0 ? sizeUsd / vault.tier.shadowAllocation : 0;
  const isOverLeverageCap = impliedLeverage > effectiveLeverageCap;
  const preview = React.useMemo(() => {
    if (sizeUsd <= 0 || marketMid == null || marketMid <= 0) return null;
    return slippagePreview({
      marketId: symbol,
      side,
      sizeUsd,
      oracleMid: marketMid,
    });
  }, [symbol, side, sizeUsd, marketMid]);

  // Funding disclosure: positive rate ⇒ longs pay shorts.
  const fundingRate = tick?.fundingRate ?? null;
  const fundingPayer =
    fundingRate == null ? null : fundingRate >= 0 ? "longs pay" : "shorts pay";

  // Estimated liquidation off the fill, for the selected mode + leverage. Cross
  // availability is the account equity; isolated is the allocated initial margin.
  const estLiquidation = React.useMemo(() => {
    if (!preview || sizeUsd <= 0 || !market) return null;
    const maxLev = market.maxLeverage;
    const maint = sizeUsd * (1 / (2 * maxLev));
    const isolatedMargin = sizeUsd / effectiveLeverage;
    return liquidationPrice({
      entryPrice: preview.fill,
      sizeUsd,
      side,
      maxLeverage: maxLev,
      marginMode: effectiveMode,
      isolatedMargin,
      accountValue: vault.equity,
      maintMarginRequired: maint,
    });
  }, [
    preview,
    sizeUsd,
    market,
    side,
    effectiveMode,
    effectiveLeverage,
    vault.equity,
  ]);

  /* ------------------------------------------------------------------ */
  /* Disable conditions                                                   */
  /* ------------------------------------------------------------------ */

  const RATE_LIMIT_MS = 2000;
  const rateLimitUntil =
    lastSubmitAt !== null ? lastSubmitAt + RATE_LIMIT_MS : null;
  const isRateLimited = rateLimitUntil !== null && Date.now() < rateLimitUntil;

  const isVaultPaused = vault.status !== "active";
  // No live oracle price (or a stale/halted feed) -> never quote or fill.
  const isPriceUnavailable = marketMid == null || marketMid <= 0;
  const isFeedStale = halted || connection === "stale";
  const isNotSignedIn = !session.address;
  const isSizeInvalid = sizeUsd <= 0;
  const isSubmitting = submitState.phase === "submitting";

  let disabledReason: string | null = null;
  if (isNotSignedIn) disabledReason = "Sign in to trade";
  else if (isFeedStale)
    disabledReason = "Market data feed unavailable; trading suspended";
  else if (isPriceUnavailable)
    disabledReason = "Waiting for a live oracle price…";
  else if (isVaultPaused) disabledReason = `Evaluation is ${vault.status}`;
  else if (isSizeInvalid) disabledReason = "Enter a position size";
  else if (isOverLeverageCap)
    disabledReason = `Leverage exceeds ${effectiveLeverageCap}× cap for ${market?.symbol ?? symbol}`;
  else if (isRateLimited) disabledReason = null;

  const canSubmit =
    !isNotSignedIn &&
    !isFeedStale &&
    !isPriceUnavailable &&
    !isVaultPaused &&
    !isSizeInvalid &&
    !isOverLeverageCap &&
    !isRateLimited &&
    !isSubmitting;

  /* ------------------------------------------------------------------ */
  /* Submit handler                                                       */
  /* ------------------------------------------------------------------ */

  const handleSubmit = React.useCallback(() => {
    if (!canSubmit || !preview || isOverLeverageCap) return;
    const capturedSymbol = symbol;
    const capturedSide = side;
    const capturedFill = preview.fill;
    const capturedSize = sizeUsd;
    const capturedMode = effectiveMode;
    const capturedLeverage = effectiveLeverage;
    setSubmitState({ phase: "submitting" });
    setTimeout(() => {
      onSubmitOrder?.({
        symbol: capturedSymbol,
        side: capturedSide,
        sizeUsd: capturedSize,
        marginMode: capturedMode,
        leverage: capturedLeverage,
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
    }, 650);
  }, [
    canSubmit,
    preview,
    isOverLeverageCap,
    symbol,
    side,
    sizeUsd,
    effectiveMode,
    effectiveLeverage,
    onSubmitOrder,
  ]);

  const dismissConfirmation = React.useCallback(() => {
    setSubmitState({ phase: "idle" });
  }, []);

  // The selected leverage, shown against the real usable cap (per-market venue
  // cap clamped to the tier cap) — so a low-leverage perp shows its lower ceiling.
  const leverageLabel = `${effectiveLeverage}×`;
  // Strip the "venue:" prefix so UI labels show "BTC" not "hyperliquid:BTC".
  const displaySymbol = market?.symbol ?? (symbol.includes(":") ? symbol.split(":")[1]! : symbol);

  /* ------------------------------------------------------------------ */
  /* Render                                                               */
  /* ------------------------------------------------------------------ */

  return (
    <div className="flex w-full flex-col gap-0 overflow-hidden">
      {/* Header */}
      <div className="flex w-full items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">
            New Order
          </span>
          <Badge variant="leverage">{leverageLabel}</Badge>
        </div>
        <span className="text-xs text-text-faint">
          {vault.intentCount}/{vault.tier.intentCap} orders
        </span>
      </div>

      <div className="flex flex-col gap-4 p-4">
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

        {/* Side toggle */}
        <SideToggle value={side} onValueChange={setSide} />

        {/* Margin mode + leverage */}
        <MarginModeToggle
          value={effectiveMode}
          onValueChange={setMarginMode}
          forcedIsolated={forcedIsolated}
        />
        <LeverageSelector
          value={effectiveLeverage}
          cap={effectiveLeverageCap}
          onValueChange={setLeverage}
        />

        {/* Size input */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <CardLabel>Size (USD)</CardLabel>
            <span className="tabular text-xs text-text-faint">
              Max: {formatUsd(vault.tier.shadowAllocation, { decimals: 0 })}
            </span>
          </div>
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-text-muted">
              $
            </span>
            <Input
              mono
              type="number"
              min={1}
              step={50}
              autoComplete="off"
              value={rawSize}
              onChange={(e) => setRawSize(e.target.value)}
              placeholder="0"
              className="pl-7"
              aria-label="Position size in USD"
            />
          </div>
          {/* Quick-size presets */}
          <div className="mt-1.5 flex gap-1">
            {SIZE_PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setRawSize(String(preset))}
                className={cn(
                  "flex-1 rounded-sm border py-1 text-xs transition-colors",
                  rawSize === String(preset)
                    ? "border-violet/50 bg-violet/15 text-on-accent"
                    : "border-border bg-transparent text-text-faint hover:border-border-soft hover:text-text-muted",
                )}
              >
                ${preset >= 1000 ? `${preset / 1000}k` : preset}
              </button>
            ))}
          </div>
        </div>

        {/* Fill preview panel */}
        {preview && sizeUsd > 0 && (
          <div className="rounded-[var(--radius)] border border-border-soft bg-surface-2 px-3 py-3">
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">
                  Fill preview
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
                    <Info className="h-3.5 w-3.5" />
                  </button>
                </Tooltip>
              </div>
              <span className="text-xs text-text-faint">Market price</span>
            </div>

            <div className="flex flex-col">
              <SlippageRow
                label="Market price"
                value={formatUsd(preview.oracleMid, { decimals: 2 })}
                muted
              />
              <SlippageRow
                label={
                  <span className="flex items-center gap-1">
                    Size impact
                    <Tooltip
                      content={`Size-driven impact on fill price. ${formatNum(preview.slippageBps, 2)} bps for ${formatUsd(sizeUsd, { decimals: 0 })} notional.`}
                    >
                      <Info className="h-3 w-3" />
                    </Tooltip>
                  </span>
                }
                value={`+${formatNum(preview.slippageBps, 2)} bps`}
                muted
              />
              <SlippageRow
                label={
                  <span className="flex items-center gap-1 text-warn">
                    Est. fee (taker)
                    <Tooltip content="Hyperliquid taker fee charged on the fill notional. A round trip pays this twice.">
                      <Info className="h-3 w-3" />
                    </Tooltip>
                  </span>
                }
                value={`−${formatUsd(preview.feeUsd, { decimals: 2 })}`}
                warn
              />
              <SlippageRow
                label={
                  <span className="flex items-center gap-1">
                    Funding
                    <Tooltip content="Current per-interval funding rate. Positive rate ⇒ longs pay shorts; negative ⇒ shorts pay longs. Charged on the oracle-price notional at each settlement.">
                      <Info className="h-3 w-3" />
                    </Tooltip>
                  </span>
                }
                value={
                  fundingRate == null
                    ? "—"
                    : `${(fundingRate * 100).toFixed(4)}% · ${fundingPayer}`
                }
                muted
              />
              <SlippageRow
                label={
                  <span className="flex items-center gap-1">
                    Est. liquidation
                    <Tooltip content="Estimated liquidation price off mark for the selected margin mode and leverage. Cross uses account equity; isolated uses the position's allocated margin.">
                      <Info className="h-3 w-3" />
                    </Tooltip>
                  </span>
                }
                value={
                  estLiquidation == null || estLiquidation <= 0
                    ? "—"
                    : formatUsd(estLiquidation, { decimals: 2 })
                }
                muted
              />

              <div className="my-1.5 border-t border-border-soft" />

              <div className="flex items-center justify-between py-1">
                <span className="text-sm font-semibold text-text">
                  Your fill
                </span>
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "tabular text-sm font-bold",
                      side === "long" ? "text-down" : "text-up",
                    )}
                  >
                    {formatUsd(preview.fill, { decimals: 2 })}
                  </span>
                  <Badge
                    variant={side === "long" ? "down" : "up"}
                    className="text-xs"
                  >
                    {side === "long" ? "above mid" : "below mid"}
                  </Badge>
                </div>
              </div>

              <div className="flex items-center justify-between border-t border-border-soft pt-2">
                <span className="text-xs text-text-muted">Total cost</span>
                <span className="tabular text-xs font-semibold text-text">
                  {formatUsd(preview.totalCost, { decimals: 2 })}
                </span>
              </div>

              <div className="mt-2 flex items-center gap-1.5 rounded-sm bg-surface px-2 py-1.5">
                <AlertTriangle className="h-3 w-3 shrink-0 text-warn" />
                <span className="text-xs text-text-faint">
                  Fill is{" "}
                  <span className="tabular font-medium text-warn">
                    {formatNum(preview.slippageBps, 2)} bps
                  </span>{" "}
                  worse than market price, before the taker fee
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Status banners */}
        {isRateLimited && rateLimitUntil && (
          <RateLimitBanner until={rateLimitUntil} />
        )}
        {disabledReason && !isRateLimited && (
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

        {/* Submit button */}
        <Button
          type="button"
          variant={side === "long" ? "long" : "short"}
          size="lg"
          disabled={!canSubmit}
          onClick={handleSubmit}
          className="w-full font-bold tracking-wide"
        >
          {isSubmitting ? (
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
