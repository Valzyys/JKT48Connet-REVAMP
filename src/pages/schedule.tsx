import { useQuery } from "@tanstack/react-query";
import { CalendarDays } from "lucide-react";
import { useMemo, useState } from "react";
import { EventCard, ShowRow } from "@/components/cards";
import { Page } from "@/components/page";
import { EmptyState, ErrorState, PageHero, SkeletonGrid, cx } from "@/components/ui";
import { dayKey, fmtDate } from "@/lib/format";
import type { EventItem, TheaterShow } from "@/lib/jkt48";
import { q } from "@/lib/queries";

type Entry = { kind: "show"; date: string; show: TheaterShow } | { kind: "event"; date: string; event: EventItem };

const TABS = [
  { id: "upcoming", label: "Akan datang" },
  { id: "past", label: "Sudah lewat" },
] as const;

export function SchedulePage() {
  const theater = useQuery(q.theaterList(1, 30));
  const events = useQuery(q.events());
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("upcoming");

  const groups = useMemo(() => {
    const entries: Entry[] = [
      ...(theater.data?.items ?? []).map((s) => ({ kind: "show" as const, date: s.date, show: s })),
      ...(events.data ?? []).map((e) => ({ kind: "event" as const, date: e.date, event: e })),
    ].filter((e) => dayKey(e.date));

    const today = dayKey(new Date().toISOString());
    const filtered = entries.filter((e) => (tab === "upcoming" ? dayKey(e.date) >= today : dayKey(e.date) < today));
    filtered.sort((a, b) => (tab === "upcoming" ? 1 : -1) * (new Date(a.date).getTime() - new Date(b.date).getTime()));

    const map = new Map<string, Entry[]>();
    for (const e of filtered) {
      const k = dayKey(e.date);
      map.set(k, [...(map.get(k) ?? []), e]);
    }
    return [...map.entries()];
  }, [theater.data, events.data, tab]);

  const loading = theater.isLoading || events.isLoading;

  return (
    <Page deps={[groups]}>
      <PageHero
        eyebrow="Kalender"
        title={
          <>
            Jadwal <span className="text-brand">JKT48.</span>
          </>
        }
        desc="Pertunjukan theater dan event JKT48 dikelompokkan per hari, dalam waktu Indonesia Barat."
      >
        <div className="inline-flex rounded-full border border-line bg-card p-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={cx("rounded-full px-4 py-1.5 text-[13px] font-semibold transition", tab === t.id ? "bg-ink text-bg" : "text-ink-soft hover:text-ink")}
            >
              {t.label}
            </button>
          ))}
        </div>
      </PageHero>

      <section className="container-x pt-12">
        {theater.isError && events.isError ? (
          <ErrorState error={theater.error} onRetry={() => (theater.refetch(), events.refetch())} />
        ) : loading ? (
          <SkeletonGrid count={5} className="space-y-3" item="h-[88px] rounded-3xl" />
        ) : groups.length ? (
          <div className="space-y-12">
            {groups.map(([day, items]) => (
              <div key={day} className="grid gap-4 md:grid-cols-[220px_1fr]">
                <div data-reveal className="md:sticky md:top-24 md:self-start">
                  <p className="font-display text-2xl font-extrabold tracking-tight">{fmtDate(items[0].date, { weekday: "long" })}</p>
                  <p className="num mt-1 text-sm text-ink-soft">{fmtDate(items[0].date)}</p>
                </div>
                <div className="space-y-3">
                  {items.map((e) =>
                    e.kind === "show" ? <ShowRow key={`s-${e.show.id}`} s={e.show} /> : <EventCard key={`e-${e.event.id}`} e={e.event} />,
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState icon={<CalendarDays className="h-5 w-5" />} title={tab === "upcoming" ? "Belum ada jadwal mendatang" : "Belum ada riwayat jadwal"} />
        )}
      </section>
    </Page>
  );
}
