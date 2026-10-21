import { useQuery } from "@tanstack/react-query";
import { BirthdayRow, daysUntil } from "@/components/cards";
import { Countdown } from "@/components/countdown";
import { Page } from "@/components/page";
import { Empty, ErrorState, Img, PageHeader, SkeletonList } from "@/components/ui";
import { q } from "@/lib/queries";

export function BirthdayPage() {
  const bday = useQuery(q.birthdays());
  const [next, ...rest] = bday.data ?? [];

  return (
    <Page deps={[bday.data]}>
      <PageHeader title="Birthday" desc="Ulang tahun member JKT48 yang akan datang." />
      <section className="container-x pt-8">
        {bday.isError ? (
          <ErrorState error={bday.error} onRetry={() => bday.refetch()} />
        ) : bday.isLoading ? (
          <SkeletonList rows={5} className="h-11" />
        ) : next ? (
          <div className="grid gap-x-12 gap-y-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <div data-reveal className="grid grid-cols-[140px_1fr] gap-5 sm:grid-cols-[200px_1fr]">
              <Img src={next.img} alt={next.name} eager className="aspect-[3/4] w-full rounded-md object-cover object-top" />
              <div className="flex flex-col justify-end">
                <p className="text-[14px] font-semibold text-brand">{daysUntil(next.next) === 0 ? "Hari ini" : "Berikutnya"}</p>
                <p className="condensed mt-1 text-[clamp(2.5rem,6vw,4rem)] uppercase leading-[0.85]">{next.name}</p>
                <p className="num mt-2 text-ink-soft">
                  {next.next.toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long" })} · {next.age} tahun
                </p>
                {daysUntil(next.next) > 0 && (
                  <p className="mt-4 border-t border-line pt-3 text-[14px]">
                    <span className="text-ink-soft">Dalam </span>
                    <Countdown target={next.next} className="font-semibold" />
                  </p>
                )}
              </div>
            </div>
            <div>{rest.map((b) => <BirthdayRow key={b.id} b={b} />)}</div>
          </div>
        ) : (
          <Empty>Belum ada data ulang tahun.</Empty>
        )}
      </section>
    </Page>
  );
}
