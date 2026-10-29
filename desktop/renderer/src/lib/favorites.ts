import { useSyncExternalStore } from "react";

// Member favorit, disimpan lokal di aplikasi (sama dengan fitur favorit aplikasi Android/iPhone).
const KEY = "jkc:favorites";
const subs = new Set<() => void>();
let cache: string[] = (() => {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || "[]");
    return Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
})();

export function toggleFavorite(id: string) {
  cache = cache.includes(id) ? cache.filter((x) => x !== id) : [...cache, id];
  try {
    localStorage.setItem(KEY, JSON.stringify(cache));
  } catch {
    /* penyimpanan penuh: tetap berlaku untuk sesi ini */
  }
  subs.forEach((f) => f());
}

export function useFavorites() {
  return useSyncExternalStore(
    (f) => {
      subs.add(f);
      return () => subs.delete(f);
    },
    () => cache,
  );
}
