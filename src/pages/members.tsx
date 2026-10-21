import { useQuery } from "@tanstack/react-query";
import { Search, Users } from "lucide-react";
import { useDeferredValue, useMemo, useState } from "react";
import { MemberCard } from "@/components/cards";
import { Page } from "@/components/page";
import { EmptyState, ErrorState, PageHero, SkeletonGrid, cx } from "@/components/ui";
import { q } from "@/lib/queries";

const STATUS = [
  { id: "active", label: "Aktif" },
  { id: "graduate", label: "Graduated" },
  { id: "all", label: "Semua" },
] as const;

function genNumber(g: string) {
  return Number(/\d+/.exec(g)?.[0] ?? 999);
}

export function MembersPage() {
  const members = useQuery(q.members());
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<(typeof STATUS)[number]["id"]>("active");
  const [gen, setGen] = useState("");
  const term = useDeferredValue(query.trim().toLowerCase());

  const gens = useMemo(
    () => [...new Set((members.data ?? []).map((m) => m.generation).filter(Boolean))].sort((a, b) => genNumber(a) - genNumber(b)),
    [members.data],
  );

  const shown = useMemo(
    () =>
      (members.data ?? [])
        .filter((m) => (status === "all" ? true : status === "active" ? !m.isGraduate : m.isGraduate))
        .filter((m) => !gen || m.generation === gen)
        .filter((m) => !term || `${m.name} ${m.nickname}`.toLowerCase().includes(term))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [members.data, status, gen, term],
  );

  return (
    <Page deps={[shown]}>
      <PageHero
        eyebrow="Direktori"
        title={
          <>
            Member <span className="text-brand">JKT48.</span>
          </>
        }
        desc="Cari member berdasarkan nama atau nama panggilan, lalu buka profil lengkapnya."
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          <label className="flex h-12 w-full items-center gap-3 rounded-full border border-line bg-card px-5 transition focus-within:border-ink sm:w-80">
            <Search className="h-4 w-4 text-ink-soft" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cari member…"
              className="h-full w-full bg-transparent text-sm outline-none placeholder:text-ink-soft"
              aria-label="Cari member"
            />
          </label>
          <div className="inline-flex w-fit rounded-full border border-line bg-card p-1">
            {STATUS.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setStatus(s.id)}
                className={cx("rounded-full px-4 py-2 text-[13px] font-semibold transition", status === s.id ? "bg-ink text-bg" : "text-ink-soft hover:text-ink")}
              >
                {s.label}
              </button>
            ))}
          </div>
          {gens.length > 0 && (
            <select
              value={gen}
              onChange={(e) => setGen(e.target.value)}
              aria-label="Filter generasi"
              className="h-12 w-fit rounded-full border border-line bg-card px-5 text-sm font-semibold outline-none"
            >
              <option value="">Semua generasi</option>
              {gens.map((g) => (
                <option key={g} value={g}>
                  {/^\d+$/.test(g) ? `Generasi ${g}` : g}
                </option>
              ))}
            </select>
          )}
        </div>
      </PageHero>

      <section className="container-x pt-12">
        {members.isError ? (
          <ErrorState error={members.error} onRetry={() => members.refetch()} />
        ) : members.isLoading ? (
          <SkeletonGrid count={10} className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5" item="aspect-[4/5.8] rounded-3xl" />
        ) : shown.length ? (
          <>
            <p className="num mb-5 text-sm text-ink-soft">{shown.length} member</p>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {shown.map((m) => (
                <MemberCard key={m.id} m={m} />
              ))}
            </div>
          </>
        ) : (
          <EmptyState icon={<Users className="h-5 w-5" />} title="Member tidak ditemukan" desc="Coba kata kunci atau filter lain." />
        )}
      </section>
    </Page>
  );
}
