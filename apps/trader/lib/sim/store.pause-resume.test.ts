import { beforeEach, describe, expect, it } from "vitest";
import { TIERS } from "@/lib/mock/fixtures";
import { useSimStore } from "./store";

/**
 * MAJ-7 regression: manual pause/resume is the ONLY path that reaches the
 * "inactive" terminal status (detectOutcome never produces it). Pause flips an
 * active eval to inactive + stamps inactiveAt; resume reactivates it (status
 * back to active, idle window pushed out) so the round-trip is reachable.
 */
const STARTER = TIERS[0];
const NOW = 1_749_312_000_000;
const DAY_MS = 86_400_000;

function freshVault(): string {
  const vaultId = `vault_pause_${Math.random().toString(36).slice(2)}`;
  useSimStore.getState().startEvaluation(vaultId, STARTER, "0xowner", NOW);
  return vaultId;
}

describe("pause/resume — inactive round-trip (MAJ-7)", () => {
  beforeEach(() => {
    useSimStore.setState({ vaults: {} });
  });

  it("pauses an active eval: status inactive, inactiveAt stamped at now", () => {
    const vaultId = freshVault();
    expect(useSimStore.getState().vaults[vaultId].status).toBe("active");

    useSimStore.getState().pauseEvaluation(vaultId, NOW);
    const v = useSimStore.getState().vaults[vaultId];
    expect(v.status).toBe("inactive");
    expect(v.inactiveAt).toBe(NOW);
  });

  it("resumes a paused eval: status active, idle window pushed out 7 days", () => {
    const vaultId = freshVault();
    useSimStore.getState().pauseEvaluation(vaultId, NOW);

    const resumeAt = NOW + 60_000;
    useSimStore.getState().resumeEvaluation(vaultId, resumeAt);
    const v = useSimStore.getState().vaults[vaultId];
    expect(v.status).toBe("active");
    expect(v.inactiveAt).toBe(resumeAt + 7 * DAY_MS);
  });

  it("completes a full pause -> inactive -> resume round-trip", () => {
    const vaultId = freshVault();

    useSimStore.getState().pauseEvaluation(vaultId, NOW);
    expect(useSimStore.getState().vaults[vaultId].status).toBe("inactive");

    useSimStore.getState().resumeEvaluation(vaultId, NOW + 1000);
    expect(useSimStore.getState().vaults[vaultId].status).toBe("active");
  });

  it("only an active vault can pause (terminal stays terminal)", () => {
    const vaultId = freshVault();
    useSimStore.setState((s) => ({
      vaults: {
        ...s.vaults,
        [vaultId]: { ...s.vaults[vaultId], status: "failed" },
      },
    }));

    useSimStore.getState().pauseEvaluation(vaultId, NOW);
    expect(useSimStore.getState().vaults[vaultId].status).toBe("failed");
  });

  it("only an inactive vault can resume (active is left untouched)", () => {
    const vaultId = freshVault();
    const before = useSimStore.getState().vaults[vaultId];

    useSimStore.getState().resumeEvaluation(vaultId, NOW + 1000);
    const after = useSimStore.getState().vaults[vaultId];
    expect(after.status).toBe("active");
    expect(after.inactiveAt).toBe(before.inactiveAt);
  });
});
