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

const pad = (n: number) => String(n).padStart(2, "0");

/** Hitung mundur ringkas: "2 hari 04:12:33". */
export function Countdown({ target, className }: { target: string | Date; className?: string }) {
  const now = useNow();
  const c = countdown(new Date(target), now);
  return (
    <span className={`num ${className ?? ""}`}>
      {c ? `${c.d ? `${c.d} hari ` : ""}${pad(c.h)}:${pad(c.m)}:${pad(c.s)}` : "sedang berlangsung"}
    </span>
  );
}

/** Jam WIB yang berjalan, untuk baris tanggal di beranda. */
export function Clock() {
  const now = useNow(15_000);
  const f = new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  return <span className="num">{f.format(now)} WIB</span>;
}
