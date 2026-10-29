import { useEffect, useState } from "react";
import { bridge, type AppState } from "./bridge";

let current: AppState | null = null;
const subs = new Set<(s: AppState) => void>();
bridge.state().then((s) => {
  current = s;
  subs.forEach((f) => f(s));
});
bridge.on("state", (s) => {
  current = s;
  subs.forEach((f) => f(s));
});

/** Pengaturan & status aplikasi dari main process (tema, notifikasi, update, versi). */
export function useAppState() {
  const [s, set] = useState(current);
  useEffect(() => {
    subs.add(set);
    if (current) set(current);
    return () => {
      subs.delete(set);
    };
  }, []);
  return s;
}

export const setSetting = (key: keyof AppState, value: unknown) => bridge.send("set", key, value);
