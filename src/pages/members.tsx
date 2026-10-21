import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { useDeferredValue, useMemo, useState } from "react";
import { MemberCard } from "@/components/cards";
import { Page } from "@/components/page";
import { Empty, ErrorState, PageHeader, Segmented, SkeletonGrid } from "@/components/ui";
import { q } from "@/lib/queries";

const STATUS = [
  { id: "active", label: "Aktif" },
  { id: "graduate", label: "Graduated" },
  { id: "all", label: "Semua" },
] as const;

export function MembersPage() {
  const members = useQuery(q.members());
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<(typeof STATUS)[number]["id"]>("active");
  const term = useDeferredValue(query.trim().toLowerCase());

  const shown = useMemo(
    () =>
      (members.data ?? [])
        .filter((m) => (status === "all" ? true : status === "active" ? !m.isGraduate : m.isGraduate))
        .filter((m) => !term || `${m.name} ${m.nickname}`.toLowerCase().includes(term))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [members.data, status, term],
  );

  return (
    <Page deps={[shown]}>
      <PageHeader
        label="The lineup"
        title="Member"
        count={members.isSuccess ? shown.length : undefined}
        desc="Direktori member JKT48. Ketik nama atau nama panggilan."
        aside={
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex h-10 items-center gap-2 rounded-full border border-line bg-card px-4 focus-within:border-brand">
              <Search className="h-4 w-4 text-ink-soft" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Cari nama…"
                aria-label="Cari member"
                className="w-40 bg-transparent text-[14px] outline-none placeholder:text-ink-soft"
              />
            </label>
            <Segmented value={status} options={STATUS} onChange={setStatus} />
          </div>
        }
      />
      <section className="container-x pt-8">
        {members.isError ? (
          <ErrorState error={members.error} onRetry={() => members.refetch()} />
        ) : members.isLoading ? (
          <SkeletonGrid count={12} className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-4 lg:grid-cols-6" item="aspect-[3/4]" />
        ) : shown.length ? (
          <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 md:grid-cols-4 2xl:grid-cols-6">
            {shown.map((m, i) => (
              <MemberCard key={m.id} m={m} n={i + 1} />
            ))}
          </div>
        ) : (
          <Empty>Tidak ada member yang cocok dengan “{query}”.</Empty>
        )}
      </section>
    </Page>
  );
}
