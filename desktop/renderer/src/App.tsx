import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, type ReactNode } from "react";
import { Sidebar, Topbar } from "@/components/shell";
import { Empty } from "@/components/ui";
import { useAppState } from "@/lib/app-state";
import { bridge } from "@/lib/bridge";
import { navigate, useRoute } from "@/lib/router";
import { HomePage } from "@/pages/home";
import { LivePage, WatchPage } from "@/pages/live";
import { BirthdaysPage, NewsDetailPage, NewsPage, SocialPage, VideoDetailPage, VideosPage } from "@/pages/media";
import { MemberDetailPage, MembersPage } from "@/pages/members";
import { RecentDetailPage, RecentPage } from "@/pages/recent";
import { SchedulePage, TheaterDetailPage, TheaterPage } from "@/pages/schedule";
import { SettingsPage } from "@/pages/settings";

function page(parts: string[]): ReactNode {
  const [a = "", b] = parts;
  switch (a) {
    case "":
      return <HomePage />;
    case "live":
      return <LivePage />;
    case "watch":
      return b ? <WatchPage id={b} /> : <LivePage />;
    case "schedule":
      return <SchedulePage />;
    case "theater":
      return b ? <TheaterDetailPage id={b} /> : <TheaterPage />;
    case "member":
      return b ? <MemberDetailPage id={b} /> : <MembersPage />;
    case "recent":
      return b ? <RecentDetailPage id={b} /> : <RecentPage />;
    case "news":
      return b ? <NewsDetailPage id={b} /> : <NewsPage />;
    case "video":
      return b ? <VideoDetailPage id={b} /> : <VideosPage />;
    case "birthday":
      return <BirthdaysPage />;
    case "social":
      return <SocialPage />;
    case "settings":
      return <SettingsPage />;
    default:
      return <Empty title="Halaman tidak ditemukan" />;
  }
}

/** Posisi gulir per rute, supaya tombol Kembali mengembalikan posisi daftar. */
const scrollMemory = new Map<string, number>();

export function App() {
  const { path, parts } = useRoute();
  const state = useAppState();
  const client = useQueryClient();
  const main = useRef<HTMLElement>(null);
  const last = useRef(path);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", state?.theme === "dark");
  }, [state?.theme]);

  // Daftar live didorong main process (polling yang sama dengan notifikasi).
  useEffect(() => bridge.on("live", (list) => client.setQueryData(["live"], list)), [client]);
  useEffect(() => bridge.on("navigate", (route) => navigate(route)), []);

  // Kembali/maju: Alt+←/→ dan tombol samping mouse.
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.altKey && e.key === "ArrowLeft") history.back();
      if (e.altKey && e.key === "ArrowRight") history.forward();
    };
    const mouse = (e: MouseEvent) => {
      if (e.button === 3) history.back();
      if (e.button === 4) history.forward();
    };
    window.addEventListener("keydown", key);
    window.addEventListener("mouseup", mouse);
    return () => {
      window.removeEventListener("keydown", key);
      window.removeEventListener("mouseup", mouse);
    };
  }, []);

  useEffect(() => {
    const el = main.current;
    if (!el) return;
    scrollMemory.set(last.current, el.scrollTop);
    last.current = path;
    el.scrollTop = scrollMemory.get(path) ?? 0;
  }, [path]);

  return (
    <div className="flex h-full">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar />
        <main ref={main} className="scroll flex-1">
          <div key={path} className="page-in mx-auto w-full max-w-[1500px] px-8 pb-16 pt-3">
            {page(parts)}
          </div>
        </main>
      </div>
    </div>
  );
}
