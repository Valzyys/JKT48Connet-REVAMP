import { useQuery } from "@tanstack/react-query";
import { ArrowDown, MessageCircle } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { q, type LiveComment } from "@/lib/data";
import { fmtTime } from "@/lib/format";
import { cx, Img, PixelCross } from "./ui";

const KEEP = 300;
const STATUS: Record<string, [string, string]> = {
  connected: ["Tersambung", "bg-[#3ddc84]"],
  connecting: ["Menyambung…", "bg-[#fde6b0]"],
  reconnecting: ["Menyambung ulang…", "bg-[#fde6b0]"],
  ended: ["Live selesai", "bg-white/40"],
  unavailable: ["Belum ada komentar teramati", "bg-white/40"],
};

/** Warna nama penonton yang tetap per nama (palet hangat brand). */
const NAME_COLORS = ["#ff8a98", "#fde6b0", "#ffb38a", "#9fd8ff", "#c7a8ff", "#8be3b4", "#ffd36e", "#ff9fd1"];
function nameColor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0;
  return NAME_COLORS[Math.abs(h) % NAME_COLORS.length];
}

/**
 * Komentar live Showroom (baca saja). Data: buffer 100 komentar terakhir dari relay JKT48Connect lewat worker
 * (`/api/app/showroom-comments/:room`, API key tetap di server), diperbarui tiap 3 detik dan digabung per `seq`.
 */
export function LiveChat({ room, className }: { room: string; className?: string }) {
  const res = useQuery(q.liveComments(room));
  const [items, setItems] = useState<LiveComment[]>([]);
  const [fresh, setFresh] = useState<Set<string>>(new Set());
  const [stick, setStick] = useState(true);
  const [unread, setUnread] = useState(0);
  const box = useRef<HTMLDivElement>(null);
  const seen = useRef(new Set<string>());

  // Gabungkan hasil polling baru tanpa duplikat; tandai yang baru untuk animasi masuk.
  useEffect(() => {
    const incoming = res.data?.comments ?? [];
    const add = incoming.filter((c) => !seen.current.has(c.id));
    if (!add.length) return;
    add.forEach((c) => seen.current.add(c.id));
    setItems((old) => [...old, ...add].sort((a, b) => a.seq - b.seq).slice(-KEEP));
    // Pemuatan pertama tidak dianimasikan satu per satu.
    if (seen.current.size !== add.length) setFresh(new Set(add.map((c) => c.id)));
    if (!stick) setUnread((n) => n + add.length);
  }, [res.data, stick]);

  useLayoutEffect(() => {
    if (stick && box.current) box.current.scrollTop = box.current.scrollHeight;
  }, [items, stick]);

  const status = STATUS[res.data?.status ?? (res.isPending ? "connecting" : "unavailable")] ?? STATUS.unavailable;

  return (
    <section className={cx("flex min-h-0 flex-col overflow-hidden rounded-[24px] bg-[#1d1517] text-[#f3ece6] shadow-[0_24px_50px_-28px_rgb(15_10_12/0.8)]", className)}>
      <header className="flex items-center justify-between gap-3 border-b border-white/[0.07] px-5 py-4">
        <div>
          <p className="flex items-center gap-2 text-[15px] font-extrabold">
            <MessageCircle className="h-4 w-4 text-[#ff3b52]" /> Komentar live
          </p>
          <p className="mt-1 flex items-center gap-1.5 font-mono text-[10.5px] text-white/50">
            <span className={cx("h-1.5 w-1.5 rounded-full", status[1], res.data?.status === "connected" && "animate-pulse")} />
            {status[0]}
          </p>
        </div>
        <span className="pill bg-white/[0.07] text-white/60">{items.length} komentar</span>
      </header>

      <div className="relative min-h-0 flex-1">
        <div
          ref={box}
          className="scroll h-full space-y-1 px-3 py-3"
          onScroll={(e) => {
            const el = e.currentTarget;
            const atEnd = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
            setStick(atEnd);
            if (atEnd) setUnread(0);
          }}
        >
          {items.length ? (
            items.map((c) => (
              <div key={c.id} className={cx("group flex gap-2.5 rounded-[12px] px-2 py-1.5 transition-colors hover:bg-white/[0.04]", fresh.has(c.id) && "chat-in")}>
                <Img src={c.avatar} className="mt-0.5 h-7 w-7 shrink-0 rounded-full bg-white/10" fit="contain" />
                <p className="selectable min-w-0 text-[13.5px] leading-snug">
                  <span className="mr-1.5 font-bold" style={{ color: nameColor(c.name) }}>
                    {c.name || "Penonton"}
                  </span>
                  <span className="break-words text-white/90">{c.text}</span>
                  {c.at && <span className="ml-1.5 hidden font-mono text-[10px] text-white/30 group-hover:inline">{fmtTime(c.at)}</span>}
                </p>
              </div>
            ))
          ) : (
            <div className="grid h-full place-items-center px-6 text-center">
              <div>
                <PixelCross className="mx-auto h-10 w-10" cell="fill-white/10" blink={4} />
                <p className="mt-3 text-[14px] font-bold">{res.isPending ? "Memuat komentar…" : "Belum ada komentar"}</p>
                <p className="mt-1 text-[12px] leading-relaxed text-white/50">Komentar penonton Showroom muncul di sini secara langsung.</p>
              </div>
            </div>
          )}
        </div>
        {!stick && unread > 0 && (
          <button
            type="button"
            onClick={() => {
              setStick(true);
              setUnread(0);
            }}
            className="rise absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-[#e1243a] px-3.5 py-1.5 text-[12px] font-bold text-white shadow-lg"
            style={{ animationDuration: "0.25s" }}
          >
            <ArrowDown className="h-3.5 w-3.5" /> {unread} komentar baru
          </button>
        )}
      </div>

      <footer className="border-t border-white/[0.07] px-5 py-3 text-[11px] leading-relaxed text-white/40">
        {res.data?.gap ? "Sebagian komentar terlewat (di luar buffer relay). " : ""}Hanya baca. Untuk ikut berkomentar, buka live di Showroom.
      </footer>
    </section>
  );
}
