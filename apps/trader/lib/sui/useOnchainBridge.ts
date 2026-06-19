"use client";

import { usePrivy } from "@privy-io/react-auth";
import { useEffect, useRef } from "react";
import { suiWalletAddress } from "@/lib/auth";
import type { TradeRecord, VaultStatus } from "@/lib/mock/types";
import { type SimVault, useSimStore } from "@/lib/sim/store";
import {
  isRealizedClose,
  postBreach,
  postClose,
  postFail,
  postPass,
} from "@/lib/sui/bridge";
import { isSuiConfigured } from "@/lib/sui/config";
import { useTradingAccount } from "@/lib/sui/useTradingAccount";

/**
 * The off-chain → on-chain bridge. Watches the paper engine's persisted vault
 * and mirrors its realized closes and evaluation outcome onto the deployed
 * contracts through the firm-signed executor routes:
 *
 *  - every realized position CLOSE  → POST /api/trades/close  (log_trade)
 *  - status flips to "passed"       → POST /api/evaluation/pass
 *  - status flips to "failed"       → POST /api/evaluation/fail
 *  - an unrealized-equity DD breach → POST /api/account/breach (register_dd_breach)
 *
 * On-chain equity tracks ONLY realized closes; unrealized PnL is never streamed.
 * The sim's drawdown gate fires on equity INCLUDING unrealized PnL (a breach the
 * realized on-chain gates can't see), so a "failed" outcome whose violated rule
 * is drawdown also registers the off-chain breach before failing the evaluation.
 *
 * Idempotency: a per-account ledger in localStorage records which trade ids and
 * which terminal outcome have already committed on-chain, so a re-mount, a price
 * tick, or a page reload (the sim store is persisted) never double-sends. A send
 * is only recorded once the route confirms success, so a transient failure is
 * retried on the next change rather than silently dropped.
 */
export function useOnchainBridge(vaultId: string): void {
  const { user, getAccessToken } = usePrivy();
  const suiAddress = suiWalletAddress(user);
  const { data: accountId } = useTradingAccount(suiAddress);

  // Keep the token getter in a ref so the subscription effect doesn't re-run
  // (and re-subscribe) on every Privy render.
  const getToken = useRef(getAccessToken);
  getToken.current = getAccessToken;

  useEffect(() => {
    if (!accountId || !isSuiConfigured()) return;

    const ledger = loadLedger(accountId);
    let pumping = false;

    // Serialize sends so a burst of ticks can't fire the same trade twice before
    // its ledger entry is written; each run drains everything outstanding.
    const pump = async () => {
      if (pumping) return;
      pumping = true;
      try {
        let vault = useSimStore.getState().vaults[vaultId];
        while (vault && (await reconcile(vault, accountId, ledger, getToken.current))) {
          vault = useSimStore.getState().vaults[vaultId];
        }
      } finally {
        pumping = false;
      }
    };

    void pump();
    const unsubscribe = useSimStore.subscribe(() => void pump());
    return unsubscribe;
  }, [accountId, vaultId]);
}

/* -------------------------------------------------------------------------- */
/* Idempotency ledger                                                          */
/* -------------------------------------------------------------------------- */

interface BridgeLedger {
  sentTrades: Set<string>;
  /** the terminal outcome already committed on-chain, if any */
  outcome: "passed" | "failed" | null;
  breachSent: boolean;
}

const ledgerKey = (accountId: string) => `onchain-bridge:${accountId}`;

function loadLedger(accountId: string): BridgeLedger {
  if (typeof localStorage === "undefined") {
    return { sentTrades: new Set(), outcome: null, breachSent: false };
  }
  try {
    const raw = localStorage.getItem(ledgerKey(accountId));
    if (raw) {
      const parsed = JSON.parse(raw) as {
        sentTrades?: string[];
        outcome?: "passed" | "failed" | null;
        breachSent?: boolean;
      };
      return {
        sentTrades: new Set(parsed.sentTrades ?? []),
        outcome: parsed.outcome ?? null,
        breachSent: parsed.breachSent ?? false,
      };
    }
  } catch {
    // Corrupt ledger — fall through to a fresh one.
  }
  return { sentTrades: new Set(), outcome: null, breachSent: false };
}

function persistLedger(accountId: string, ledger: BridgeLedger): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(
      ledgerKey(accountId),
      JSON.stringify({
        sentTrades: [...ledger.sentTrades],
        outcome: ledger.outcome,
        breachSent: ledger.breachSent,
      }),
    );
  } catch {
    // Storage full/unavailable — the in-memory ledger still guards this session.
  }
}

/* -------------------------------------------------------------------------- */
/* Reconciliation                                                              */
/* -------------------------------------------------------------------------- */

type TokenGetter = () => Promise<string | null>;

/**
 * Commits the single highest-priority outstanding on-chain action for the
 * vault's current state, returning true if it sent one (so the caller loops to
 * drain the rest) and false when everything is already on-chain. Closes are
 * settled oldest-first before any terminal outcome, so the chain sees equity
 * move through the same trades that produced the pass/fail.
 */
async function reconcile(
  vault: SimVault,
  accountId: string,
  ledger: BridgeLedger,
  getToken: TokenGetter,
): Promise<boolean> {
  // 1) Realized closes, oldest first (store prepends, so iterate in reverse).
  for (let i = vault.trades.length - 1; i >= 0; i--) {
    const trade = vault.trades[i];
    if (!isRealizedClose(trade) || ledger.sentTrades.has(trade.id)) continue;
    return sendClose(accountId, trade, ledger, getToken);
  }

  // 2) An unrealized-equity drawdown breach precedes the fail it produces.
  const isDrawdownFail =
    vault.status === "failed" && vault.violatedRule === "drawdown";
  if (isDrawdownFail && !ledger.breachSent) {
    if (await postBreach(getToken, accountId)) {
      ledger.breachSent = true;
      persistLedger(accountId, ledger);
      return true;
    }
    return false;
  }

  // 3) The terminal pass/fail, once and only once.
  if (
    (vault.status === "passed" || vault.status === "failed") &&
    ledger.outcome === null
  ) {
    return sendOutcome(accountId, vault.status, ledger, getToken);
  }

  return false;
}

async function sendClose(
  accountId: string,
  trade: TradeRecord,
  ledger: BridgeLedger,
  getToken: TokenGetter,
): Promise<boolean> {
  if (await postClose(getToken, accountId, trade)) {
    ledger.sentTrades.add(trade.id);
    persistLedger(accountId, ledger);
    return true;
  }
  return false;
}

async function sendOutcome(
  accountId: string,
  status: Extract<VaultStatus, "passed" | "failed">,
  ledger: BridgeLedger,
  getToken: TokenGetter,
): Promise<boolean> {
  const ok =
    status === "passed"
      ? await postPass(getToken, accountId)
      : await postFail(getToken, accountId);
  if (ok) {
    ledger.outcome = status;
    persistLedger(accountId, ledger);
    return true;
  }
  return false;
}
