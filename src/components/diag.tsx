import { useEffect, useReducer } from "react";
import { createPortal } from "react-dom";
import { diagLog, onDiag } from "@/lib/api";

/**
 * Panel diagnostik, hanya tampil dengan `?diag=1`. Berisi kemampuan browser dan langkah sesi/API terakhir
 * (tanpa data atau kunci) supaya masalah di perangkat pengunjung bisa dilacak dari satu screenshot.
 */
export function Diag() {
  const enabled = typeof location !== "undefined" && new URLSearchParams(location.search).get("diag") === "1";
  const [, rerender] = useReducer((n: number) => n + 1, 0);
  useEffect(() => (enabled ? onDiag(rerender) : undefined), [enabled]);
  if (!enabled) return null;

  const env = [
    `UA: ${navigator.userAgent}`,
    `secureContext=${window.isSecureContext} subtle=${!!crypto?.subtle} idb=${"indexedDB" in window} cookies=${navigator.cookieEnabled} sw=${!!navigator.serviceWorker?.controller}`,
    `jam perangkat: ${new Date().toISOString()}`,
  ];
  return createPortal(
    <div className="fixed inset-x-2 bottom-2 z-[2147483647] max-h-[45vh] overflow-auto rounded-xl bg-black/90 p-3 font-mono text-[11px] leading-snug text-green-300">
      <p className="mb-1 font-bold text-white">JKT48Connect · diagnostik (screenshot & kirim ke admin)</p>
      {[...env, "—", ...(diagLog.length ? diagLog : ["(belum ada catatan)"])].map((l, i) => (
        <p key={i} className="break-all">
          {l}
        </p>
      ))}
    </div>,
    document.body,
  );
}
