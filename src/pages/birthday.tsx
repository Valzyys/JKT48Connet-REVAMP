import { useQuery } from "@tanstack/react-query";
import { Cake } from "lucide-react";
import { BirthdayCard } from "@/components/cards";
import { Countdown } from "@/components/countdown";
import { Page } from "@/components/page";
import { EmptyState, ErrorState, Img, PageHero, SkeletonGrid } from "@/components/ui";
import { fmtDate } from "@/lib/format";
import { q } from "@/lib/queries";

export function BirthdayPage() {
  const bday = useQuery(q.birthdays());
  const [next, ...rest] = bday.data ?? [];

  return (
    <Page deps={[bday.data]}>
      <PageHero
        eyebrow="Seitansai"
        title={
          <>
            Ulang tahun <span className="text-brand">member.</span>
          </>
        }
        desc="Hitung mundur ulang tahun member JKT48 berikutnya. Jangan lupa siapkan ucapan terbaikmu ♡"
      />
      <section className="container-x pt-12">
        {bday.isError ? (
          <ErrorState error={bday.error} onRetry={() => bday.refetch()} />
        ) : bday.isLoading ? (
          <SkeletonGrid count={5} className="flex gap-4 overflow-hidden" item="aspect-[4/5] w-56 shrink-0 rounded-3xl" />
        ) : next ? (
          <>
            <div data-reveal className="grid overflow-hidden rounded-[36px] border border-line bg-card md:grid-cols-[320px_1fr]">
              <Img src={next.img} alt={next.name} eager className="aspect-[4/5] w-full object-cover md:aspect-auto md:h-full" />
              <div className="flex flex-col justify-center gap-6 p-8 sm:p-12">
                <span className="chip w-fit bg-gold text-black">
                  <Cake className="h-3 w-3" /> Berikutnya
                </span>
                <div>
                  <h2 className="font-display text-[clamp(2.25rem,6vw,4.5rem)] font-extrabold leading-[0.95] tracking-[-0.04em]">{next.name}</h2>
                  <p className="mt-3 text-ink-soft">
                    {fmtDate(next.next.toISOString(), { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
                    {next.age ? ` · genap ${next.age} tahun` : ""}
                  </p>
                </div>
                <Countdown target={next.next} className="text-brand" />
              </div>
            </div>
            {rest.length > 0 && (
              <div className="mt-12 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 [&>*]:w-auto">
                {rest.map((b) => (
                  <BirthdayCard key={b.id} b={b} />
                ))}
              </div>
            )}
          </>
        ) : (
          <EmptyState icon={<Cake className="h-5 w-5" />} title="Belum ada data ulang tahun" />
        )}
      </section>
    </Page>
  );
}
