import { useEffect, useState } from "react";
import { countdown } from "@/lib/format";

export function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

export function Countdown({ target, className }: { target: string | Date; className?: string }) {
  const now = useNow();
  const c = countdown(new Date(target), now);
  if (!c) return <span className={className}>Sedang berlangsung</span>;
  const cell = (v: number, l: string) => (
    <span className="flex flex-col items-center">
      <span className="num text-2xl font-semibold leading-none sm:text-3xl">{String(v).padStart(2, "0")}</span>
      <span className="mt-1 text-[9px] font-bold uppercase tracking-[0.18em] opacity-60">{l}</span>
    </span>
  );
  return (
    <span className={`flex items-start gap-3 ${className ?? ""}`}>
      {cell(c.d, "hari")}
      <span className="num text-xl opacity-40">:</span>
      {cell(c.h, "jam")}
      <span className="num text-xl opacity-40">:</span>
      {cell(c.m, "menit")}
      <span className="num text-xl opacity-40">:</span>
      {cell(c.s, "detik")}
    </span>
  );
}
