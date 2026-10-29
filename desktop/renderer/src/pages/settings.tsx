import { Bell, Download, ExternalLink, Monitor, Moon, Power, Sun } from "lucide-react";
import type { ReactNode } from "react";
import { PageHeader, PixelCross, cx } from "@/components/ui";
import { setSetting, useAppState } from "@/lib/app-state";
import { bridge, openExternal } from "@/lib/bridge";

function Row({ icon, title, desc, children }: { icon: ReactNode; title: string; desc: string; children: ReactNode }) {
  return (
    <div className="flex items-center gap-4 border-t border-line px-5 py-4 first:border-t-0">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[12px] bg-blush text-brand">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="font-semibold">{title}</p>
        <p className="mt-0.5 text-[13px] text-ink-soft">{desc}</p>
      </div>
      {children}
    </div>
  );
}

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" role="switch" aria-checked={on} onClick={() => onChange(!on)} className={cx("relative h-7 w-12 shrink-0 rounded-full transition-colors", on ? "bg-brand" : "bg-surface")}>
      <span className={cx("absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all", on ? "left-6" : "left-1")} />
    </button>
  );
}

const LINKS: [string, string, string][] = [
  ["Situs web", "jkt48connect.app", "https://jkt48connect.app"],
  ["Aplikasi Android & iPhone", "jkt48connect.app/apps", "https://jkt48connect.app/apps"],
  ["Bot X @JKT48Connect", "Notifikasi live & jadwal harian", "https://x.com/JKT48Connect"],
  ["Public API", "api.jkt48connect.app/docs", "https://api.jkt48connect.app/docs"],
];

export function SettingsPage() {
  const s = useAppState();
  if (!s) return null;
  return (
    <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_400px]">
      <div>
        <PageHeader label="Aplikasi desktop" title="Pengaturan" />
        <div className="panel overflow-hidden">
          <Row icon={<Bell className="h-5 w-5" />} title="Notifikasi saat member live" desc="Notifikasi Windows begitu ada member yang mulai live di Showroom atau IDN.">
            <Toggle on={s.notifyLive} onChange={(v) => setSetting("notifyLive", v)} />
          </Row>
          <Row icon={<Monitor className="h-5 w-5" />} title="Tetap berjalan di tray saat ditutup" desc="Tombol tutup menyembunyikan jendela; notifikasi live tetap masuk.">
            <Toggle on={s.closeToTray} onChange={(v) => setSetting("closeToTray", v)} />
          </Row>
          {s.canLogin && (
            <Row icon={<Power className="h-5 w-5" />} title="Jalankan saat Windows dinyalakan" desc="Aplikasi mulai diam-diam di tray supaya notifikasi live tidak terlewat.">
              <Toggle on={s.openAtLogin} onChange={(v) => setSetting("openAtLogin", v)} />
            </Row>
          )}
          <Row icon={s.theme === "dark" ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />} title="Tema" desc="Terang (kertas krem khas JKT48Connect) atau gelap.">
            <div className="flex rounded-full border border-line bg-surface p-1">
              {(["light", "dark"] as const).map((t) => (
                <button key={t} type="button" onClick={() => setSetting("theme", t)} className={cx("rounded-full px-4 py-1.5 text-[13px] font-semibold", s.theme === t ? "bg-ink text-bg" : "text-ink-soft")}>
                  {t === "light" ? "Terang" : "Gelap"}
                </button>
              ))}
            </div>
          </Row>
          <Row icon={<Download className="h-5 w-5" />} title="Update aplikasi" desc={s.update?.ready ? `Versi ${s.update.version} sudah diunduh dan siap dipasang.` : s.update ? `Mengunduh versi ${s.update.version}…` : "Update dicek & diunduh otomatis di latar belakang."}>
            {s.update?.ready ? (
              <button type="button" className="btn btn-primary" onClick={() => bridge.send("update-install")}>
                Pasang & mulai ulang
              </button>
            ) : (
              <button type="button" className="btn btn-ghost" disabled={!s.canUpdate} onClick={() => bridge.send("update-check")}>
                Cek update
              </button>
            )}
          </Row>
        </div>
        <p className="mt-4 font-mono text-[12px] text-ink-soft">Pintasan: Ctrl+K cari member · Alt+←/→ kembali/maju · Ctrl+=/− perbesar/perkecil · F11 layar penuh</p>
      </div>

      <aside className="space-y-4">
        <div className="relative overflow-hidden rounded-[28px] bg-[linear-gradient(150deg,#e1243a,#9e1326)] p-7 text-white">
          <PixelCross className="h-12 w-12" cell="fill-white" />
          <p className="condensed mt-5 text-[44px] leading-[0.85]">
            JKT48
            <br />
            <span className="text-[#1d1517]">CONNECT</span>
          </p>
          <p className="mt-4 text-[14px] text-white/85">Live, jadwal theater, recent, dan replay member JKT48 dalam satu aplikasi.</p>
          <p className="micro mt-4 text-white/70">
            Windows · versi {s.version}
          </p>
        </div>
        <div className="panel overflow-hidden">
          {LINKS.map(([t, d, u]) => (
            <button key={u} type="button" onClick={() => openExternal(u)} className="flex w-full items-center gap-3 border-t border-line px-5 py-3.5 text-left first:border-t-0 hover:bg-surface/60">
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{t}</p>
                <p className="truncate font-mono text-[11.5px] text-ink-soft">{d}</p>
              </div>
              <ExternalLink className="h-4 w-4 text-ink-soft" />
            </button>
          ))}
        </div>
        <p className="px-1 text-[12.5px] leading-relaxed text-ink-soft">Dibuat oleh Valzyys. Data dari jkt48.com, IDN Live, dan Showroom. Fan-made, tidak berafiliasi dengan JKT48 Operation Team, IDN, maupun Showroom.</p>
      </aside>
    </div>
  );
}
