"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  MOCK_SESSION_SIGNED_IN,
  MOCK_SESSION_SIGNED_OUT,
} from "@/lib/mock/fixtures";
import type { Session } from "@/lib/mock/types";

interface MockStore {
  session: Session;
  signIn: () => void;
  signOut: () => void;

  /** Privy-style login modal visibility. */
  loginOpen: boolean;
  openLogin: () => void;
  closeLogin: () => void;

  onboardingDismissed: boolean;
  dismissOnboarding: () => void;
  resetOnboarding: () => void;

  /** When true, the stale-feed banner shows site-wide and trading is paused. */
  divergenceHalt: boolean;
  setDivergenceHalt: (v: boolean) => void;
  toggleDivergenceHalt: () => void;

  /** Marks the persisted store as rehydrated on the client. */
  hydrated: boolean;
  setHydrated: () => void;
}

export const useMockStore = create<MockStore>()(
  persist(
    (set) => ({
      session: MOCK_SESSION_SIGNED_OUT,
      signIn: () => set({ session: MOCK_SESSION_SIGNED_IN, loginOpen: false }),
      signOut: () => set({ session: MOCK_SESSION_SIGNED_OUT }),

      loginOpen: false,
      openLogin: () => set({ loginOpen: true }),
      closeLogin: () => set({ loginOpen: false }),

      onboardingDismissed: false,
      dismissOnboarding: () => set({ onboardingDismissed: true }),
      resetOnboarding: () => set({ onboardingDismissed: false }),

      divergenceHalt: false,
      setDivergenceHalt: (v) => set({ divergenceHalt: v }),
      toggleDivergenceHalt: () =>
        set((s) => ({ divergenceHalt: !s.divergenceHalt })),

      hydrated: false,
      setHydrated: () => set({ hydrated: true }),
    }),
    {
      name: "trader-mock-store",
      partialize: (s) => ({ onboardingDismissed: s.onboardingDismissed }),
      onRehydrateStorage: () => (state) => {
        state?.setHydrated();
      },
    },
  ),
);
