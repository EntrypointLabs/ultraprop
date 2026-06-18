"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect } from "react";
import { DEMO_WALLET, INITIAL_PRICES, TIERS } from "@/lib/mock/fixtures";
import { usePrices, useSession } from "@/lib/mock/hooks";
import type { PriceTick, Tier } from "@/lib/mock/types";
import { type OrderIntent, toVaultState, useSimStore } from "./store";

/**
 * The paper-trading controller and the SINGLE writer of the evaluation caches.
 * It lazily opens the evaluation, advances the simulation on every price tick
 * (mark-to-market → equity → rules → breach/pass), and mirrors the persisted
 * sim record into the React Query keys the dashboard already reads
 * (`["vault"|"positions"|"trades"|"equity", vaultId]`). A real engine/indexer
 * can later replace this writer without touching a single component.
 *
 * `tier` is the tier the evaluation opens AT on first creation (carried from the
 * onboarding tier picker) — it's ignored for an already-open vault, since
 * `startEvaluation` never resets a live eval.
 *
 * Mount it once where the cockpit lives; it returns the order actions.
 */
export function usePaperEngine(
  vaultId: string,
  tier: Tier = TIERS[0],
): {
  submitOrder: (intent: OrderIntent) => void;
  /** Close a position; pass `closeUsd` for a partial close, omit for a full one. */
  closePosition: (positionId: string, closeUsd?: number) => void;
  /** Arm/edit a position's TP/SL bracket; `null` clears a leg, omit to leave it. */
  setBracket: (
    positionId: string,
    bracket: {
      takeProfit?: number | null;
      stopLoss?: number | null;
      expiresAt?: number | null;
    },
  ) => void;
  /** Cancel a position's bracket — one leg, or both when `leg` is omitted. */
  cancelBracket: (positionId: string, leg?: "tp" | "sl") => void;
  pause: () => void;
  resume: () => void;
} {
  const qc = useQueryClient();
  const prices = usePrices(); // re-renders this hook every price tick
  const { session } = useSession();
  const hydrated = useSimStore((s) => s.hydrated);
  const owner = session.address ?? DEMO_WALLET;

  const sync = useCallback(() => {
    const sim = useSimStore.getState().vaults[vaultId];
    if (!sim) return;
    qc.setQueryData(["vault", vaultId], toVaultState(sim));
    qc.setQueryData(["positions", vaultId], sim.positions);
    qc.setQueryData(["trades", vaultId], sim.trades);
    qc.setQueryData(["equity", vaultId], sim.equityCurve);
  }, [qc, vaultId]);

  // Open (idempotent) + advance the sim on each tick, then mirror into the cache.
  useEffect(() => {
    if (!hydrated) return;
    const store = useSimStore.getState();
    store.startEvaluation(vaultId, tier, owner, Date.now());
    store.tick(vaultId, prices, Date.now());
    sync();
  }, [hydrated, prices, vaultId, owner, tier, sync]);

  const livePrices = useCallback(
    () => qc.getQueryData<PriceTick[]>(["prices"]) ?? INITIAL_PRICES,
    [qc],
  );

  const submitOrder = useCallback(
    (intent: OrderIntent) => {
      useSimStore
        .getState()
        .submitOrder(vaultId, intent, livePrices(), Date.now());
      sync();
    },
    [vaultId, livePrices, sync],
  );

  const closePosition = useCallback(
    (positionId: string, closeUsd?: number) => {
      useSimStore
        .getState()
        .closePosition(vaultId, positionId, livePrices(), Date.now(), closeUsd);
      sync();
    },
    [vaultId, livePrices, sync],
  );

  const setBracket = useCallback(
    (
      positionId: string,
      bracket: {
        takeProfit?: number | null;
        stopLoss?: number | null;
        expiresAt?: number | null;
      },
    ) => {
      useSimStore.getState().setBracket(vaultId, positionId, bracket);
      sync();
    },
    [vaultId, sync],
  );

  const cancelBracket = useCallback(
    (positionId: string, leg?: "tp" | "sl") => {
      useSimStore.getState().cancelBracket(vaultId, positionId, leg);
      sync();
    },
    [vaultId, sync],
  );

  const pause = useCallback(() => {
    useSimStore.getState().pauseEvaluation(vaultId, Date.now());
    sync();
  }, [vaultId, sync]);

  const resume = useCallback(() => {
    useSimStore.getState().resumeEvaluation(vaultId, Date.now());
    sync();
  }, [vaultId, sync]);

  return {
    submitOrder,
    closePosition,
    setBracket,
    cancelBracket,
    pause,
    resume,
  };
}
