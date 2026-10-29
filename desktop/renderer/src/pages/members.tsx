import { useQuery } from "@tanstack/react-query";
import { ExternalLink, Heart, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { MemberCard, ShowRow } from "@/components/cards";
import { Empty, ErrorState, Img, PageHeader, SectionHead, Skeleton, SkeletonGrid, cx } from "@/components/ui";
import { openExternal } from "@/lib/bridge";
import { q } from "@/lib/data";
import { toggleFavorite, useFavorites } from "@/lib/favorites";
import { fmtDate } from "@/lib/format";

export function MembersPage() {
  const members = useQuery(q.members());
  const favs = useFavorites();
  const [tab, setTab] = useState<"active" | "fav" | "alumni">("active");
  const [text, setText] = useState("");
  const list = useMemo(() => {
    const all = members.data ?? [];
    const t = text.trim().toLowerCase();
    return all
      .filter((m) => (tab === "fav" ? favs.includes(m.id) : tab === "alumni" ? m.isGraduate : !m.isGraduate))
      .filter((m) => !t || m.name.toLowerCase().includes(t) || m.nickname.toLowerCase().includes(t))
      .sort((a, b) => a.name.localeCompare(b.name, "id"));
  }, [members.data, favs, tab, text]);
  const active = (members.data ?? []).filter((m) => !m.isGraduate).length;

  return (
    <div>
      <PageHeader
        label="Member JKT48"
        title="Member"
        count={active || undefined}
        desc="Profil member, jadwal theater, dan riwayat live. Tandai favorit dengan ikon hati."
        aside={
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft" />
              <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Saring nama…" className="h-10 w-[220px] rounded-full border border-line bg-card pl-10 pr-4 text-[14px] outline-none focus:border-brand" />
            </div>
            <div className="flex rounded-full border border-line bg-card p-1">
              {(
                [
                  ["active", "Aktif"],
                  ["fav", `Favorit${favs.length ? ` · ${favs.length}` : ""}`],
                  ["alumni", "Alumni"],
                ] as const
              ).map(([k, label]) => (
                <button key={k} type="button" onClick={() => setTab(k)} className={cx("rounded-full px-4 py-1.5 text-[13px] font-semibold transition-colors", tab === k ? "bg-ink text-bg" : "text-ink-soft hover:text-ink")}>
                  {label}
                </button>
              ))}
            </div>
          </div>
        }
      />
      {members.isError && !members.data ? (
        <ErrorState error={members.error} onRetry={() => members.refetch()} />
      ) : members.isPending ? (
        <SkeletonGrid count={12} className="grid grid-cols-3 gap-4 lg:grid-cols-5 2xl:grid-cols-7" item="aspect-[3/4]" />
      ) : list.length ? (
        <div className="stagger grid grid-cols-3 gap-4 lg:grid-cols-5 2xl:grid-cols-7">
          {list.map((m) => (
            <MemberCard key={m.id} m={m} />
          ))}
        </div>
      ) : tab === "fav" && !text ? (
        <Empty title="Belum ada favorit" icon={<Heart className="h-10 w-10 text-brand" />}>
          Arahkan kursor ke kartu member lalu klik ikon hati untuk menyimpannya di sini.
        </Empty>
      ) : (
        <Empty title="Tidak ditemukan">Tidak ada member yang cocok dengan “{text}”.</Empty>
      )}
    </div>
  );
}

export function MemberDetailPage({ id }: { id: string }) {
  const d = useQuery(q.member(id));
  const favs = useFavorites();
  if (d.isError && !d.data) return <ErrorState error={d.error} onRetry={() => d.refetch()} />;
  if (!d.data) return <Skeleton className="h-[480px]" />;
  const m = d.data;
  const fav = favs.includes(m.id);
  const facts = [
    ["Nama lengkap", m.fullname],
    ["Panggilan", m.nickname],
    ["Tanggal lahir", m.birthdate && fmtDate(m.birthdate)],
    ["Golongan darah", m.bloodType],
    ["Tinggi", m.height],
  ].filter(([, v]) => v);

  return (
    <div className="space-y-10">
      <div className="grid gap-8 xl:grid-cols-[360px_minmax(0,1fr)]">
        <div className="relative">
          <Img src={m.img} alt={m.name} eager className="aspect-[3/4] w-full rounded-[28px] object-top shadow-[0_30px_60px_-34px_rgb(29_21_23/0.6)]" />
          {m.isGraduate && <span className="pill absolute left-4 top-4 bg-ink text-bg">Alumni</span>}
        </div>
        <div className="min-w-0">
          <p className="micro flex items-center gap-2 text-brand">
            <span className="h-1.5 w-1.5 rounded-full bg-brand" /> {m.isGraduate ? "Alumni JKT48" : "Member JKT48"}
          </p>
          <h1 className="condensed mt-3 text-[clamp(3rem,6vw,5.4rem)] uppercase leading-[0.85]">{m.name}</h1>
          {m.jikosokai && <p className="selectable mt-4 max-w-2xl text-[17px] italic text-ink-soft">“{m.jikosokai}”</p>}
          <div className="mt-6 flex flex-wrap gap-2">
            <button type="button" onClick={() => toggleFavorite(m.id)} className={cx("btn", fav ? "btn-primary" : "btn-ghost")}>
              <Heart className={cx("h-4 w-4", fav && "fill-current")} /> {fav ? "Favorit" : "Jadikan favorit"}
            </button>
            {m.socials.map((s) => (
              <button key={s.url} type="button" className="btn btn-ghost" onClick={() => openExternal(s.url)}>
                {s.title} <ExternalLink className="h-3.5 w-3.5" />
              </button>
            ))}
          </div>
          <dl className="mt-8 grid grid-cols-2 gap-3 2xl:grid-cols-3">
            {facts.map(([k, v]) => (
              <div key={k} className="panel p-4">
                <dt className="micro text-ink-soft">{k}</dt>
                <dd className="mt-1.5 text-[16px] font-semibold">{v}</dd>
              </div>
            ))}
            {m.totalLive && (
              <div className="panel border-brand bg-brand p-4 text-white">
                <dt className="micro opacity-80">Total live</dt>
                <dd className="mt-1.5 text-[16px] font-semibold">
                  {m.totalLive.showroom} Showroom · {m.totalLive.idn} IDN
                </dd>
              </div>
            )}
          </dl>
          {m.description && <p className="selectable mt-6 max-w-3xl leading-relaxed text-ink-soft">{m.description}</p>}
        </div>
      </div>

      {m.upcomingShows.length > 0 && (
        <section>
          <SectionHead title="Show mendatang" count={m.upcomingShows.length} />
          <div className="panel overflow-hidden">
            {m.upcomingShows.map((s) => (
              <ShowRow key={s.id} s={s} />
            ))}
          </div>
        </section>
      )}
      {m.recentShows.length > 0 && (
        <section>
          <SectionHead title="Show terakhir" count={m.recentShows.length} />
          <div className="panel overflow-hidden">
            {m.recentShows.slice(0, 10).map((s) => (
              <ShowRow key={s.id} s={s} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
