import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ShowRow } from "@/components/cards";
import { Page } from "@/components/page";
import { Empty, ErrorState, PageHeader, Segmented, SkeletonList } from "@/components/ui";
import { dayKey, fmtDate } from "@/lib/format";
import type { TheaterShow } from "@/lib/jkt48";
import { q } from "@/lib/queries";

const TABS = [
  { id: "upcoming", label: "Mendatang" },
  { id: "past", label: "Sudah lewat" },
] as const;

function group(items: TheaterShow[]) {
  const map = new Map<string, TheaterShow[]>();
  for (const s of items) {
    const k = dayKey(s.date);
    if (k) map.set(k, [...(map.get(k) ?? []), s]);
  }
  return [...map.values()];
}

export function SchedulePage() {
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("upcoming");
  // Mendatang: next_schedule (show + exclusive + event). Sudah lewat: daftar theater.
  const next = useQuery(q.nextSchedule());
  const theater = useQuery({ ...q.theaterList(1, 40), enabled: tab === "past" });
  const source = tab === "upcoming" ? next : theater;

  const days = useMemo(() => {
    const now = Date.now();
    if (tab === "upcoming") return group([...(next.data ?? [])].sort((a, b) => +new Date(a.date) - +new Date(b.date)));
    const past = (theater.data?.items ?? []).filter((s) => new Date(s.date).getTime() < now);
    return group(past.sort((a, b) => +new Date(b.date) - +new Date(a.date)));
  }, [tab, next.data, theater.data]);

  return (
    <Page deps={[days]}>
      <PageHeader
        label="Stage file"
        title="Jadwal"
        count={days.reduce((n, d) => n + d.length, 0)}
        desc="Show theater, event exclusive, dan event JKT48 per hari (WIB)."
        aside={<Segmented value={tab} options={TABS} onChange={setTab} />}
      />
      <section className="container-x space-y-6 pt-8">
        {source.isError ? (
          <ErrorState error={source.error} onRetry={() => source.refetch()} />
        ) : source.isLoading ? (
          <SkeletonList rows={6} />
        ) : days.length ? (
          days.map((items) => (
            <div key={items[0].date} className="grid gap-x-6 gap-y-3 md:grid-cols-[180px_1fr]">
              <div data-reveal className="md:sticky md:top-28 md:self-start">
                <p className="condensed text-[28px] uppercase leading-none">{fmtDate(items[0].date, { weekday: "long" })}</p>
                <p className="micro mt-1.5 text-brand">{fmtDate(items[0].date)}</p>
              </div>
              <div className="panel overflow-hidden">
                {items.map((s) => (
                  <ShowRow key={`${s.id}-${s.title}`} s={s} />
                ))}
              </div>
            </div>
          ))
        ) : (
          <Empty>{tab === "upcoming" ? "Belum ada jadwal mendatang." : "Belum ada riwayat jadwal."}</Empty>
        )}
      </section>
    </Page>
  );
}
