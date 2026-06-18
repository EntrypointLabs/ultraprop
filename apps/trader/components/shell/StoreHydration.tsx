"use client";

import * as React from "react";
import { useMockStore } from "@/lib/mock/store";

/**
 * Ensures the persisted mock store reports `hydrated: true` on the client even
 * when there is no stored payload to rehydrate. Renders nothing.
 */
export function StoreHydration() {
  React.useEffect(() => {
    if (!useMockStore.getState().hydrated) {
      useMockStore.getState().setHydrated();
    }
  }, []);
  return null;
}
