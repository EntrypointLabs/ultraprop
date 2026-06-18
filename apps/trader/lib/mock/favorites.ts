"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { MarketId } from "@/lib/mock/types";

/**
 * Market favorites, persisted to localStorage and shared across the home
 * spotlight table and `/markets`. Stored as a string array (zustand `persist`
 * can't serialize a `Set`); consumers read the array and build a `Set` for O(1)
 * membership. Seeded empty so SSR and first client paint agree — the persisted
 * list hydrates client-side after mount.
 */
interface FavoritesStore {
  favorites: MarketId[];
  toggleFavorite: (sym: MarketId) => void;
}

export const useFavoritesStore = create<FavoritesStore>()(
  persist(
    (set) => ({
      favorites: [],
      toggleFavorite: (sym) =>
        set((s) => ({
          favorites: s.favorites.includes(sym)
            ? s.favorites.filter((f) => f !== sym)
            : [...s.favorites, sym],
        })),
    }),
    {
      name: "trader-favorites",
      partialize: (s) => ({ favorites: s.favorites }),
    },
  ),
);

/** The favorites as a `Set` for membership checks in the market tables. */
export function useFavorites(): {
  favorites: Set<MarketId>;
  toggleFavorite: (sym: MarketId) => void;
} {
  const list = useFavoritesStore((s) => s.favorites);
  const toggleFavorite = useFavoritesStore((s) => s.toggleFavorite);
  return { favorites: new Set(list), toggleFavorite };
}
