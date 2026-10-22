import { useSyncExternalStore } from "react";

/** Data blokir dari server (`code: "blocked"`), ditampilkan oleh src/components/blocked.tsx. */
export type BlockInfo = { incident: string; reason: string; reasonLabel: string; at: number; until: number; ip: string };

let current: BlockInfo | null = null;
const listeners = new Set<() => void>();

export function setBlocked(info: BlockInfo) {
  current = info;
  listeners.forEach((l) => l());
}

export function isBlockBody(x: unknown): x is BlockInfo & { code: "blocked" } {
  return !!x && typeof x === "object" && (x as { code?: unknown }).code === "blocked" && typeof (x as BlockInfo).incident === "string";
}

export function useBlocked() {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => current,
  );
}
