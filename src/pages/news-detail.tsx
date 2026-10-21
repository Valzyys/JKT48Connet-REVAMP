import { useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import DOMPurify from "dompurify";
import { ArrowUpRight } from "lucide-react";
import { useMemo } from "react";
import { BackLink } from "@/components/back-link";
import { Page } from "@/components/page";
import { ErrorState, Skeleton } from "@/components/ui";
import { fmtDate } from "@/lib/format";
import { q } from "@/lib/queries";

const ORIGIN = "https://jkt48.com";

/** Bersihkan HTML berita dan perbaiki tautan/gambar relatif dari situs resmi. */
function sanitize(html: string) {
  const clean = DOMPurify.sanitize(html, { USE_PROFILES: { html: true } });
  const doc = new DOMParser().parseFromString(clean, "text/html");
  doc.querySelectorAll<HTMLImageElement>("img[src^='/']").forEach((img) => (img.src = ORIGIN + img.getAttribute("src")));
  doc.querySelectorAll<HTMLAnchorElement>("a[href]").forEach((a) => {
    const href = a.getAttribute("href") ?? "";
    if (href.startsWith("/")) a.href = ORIGIN + href;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
  });
  return doc.body.innerHTML;
}

export function NewsDetailPage() {
  const { id } = useParams({ strict: false }) as { id: string };
  const news = useQuery(q.news(id));
  const n = news.data;
  const html = useMemo(() => (n?.content ? sanitize(n.content) : ""), [n?.content]);

  return (
    <Page deps={[n]}>
      <article className="container-x max-w-4xl pt-28">
        <BackLink to="/news" label="Semua berita" />
        {news.isError ? (
          <div className="pt-10">
            <ErrorState error={news.error} onRetry={() => news.refetch()} />
          </div>
        ) : !n ? (
          <div className="space-y-4 pt-10">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        ) : (
          <>
            <header className="border-b border-line pb-10 pt-10">
              <div data-reveal className="flex flex-wrap items-center gap-3">
                <span className="chip bg-brand-soft text-brand">{n.category}</span>
                <span className="num text-sm text-ink-soft">{fmtDate(n.date, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</span>
              </div>
              <h1 data-reveal className="mt-5 font-display text-[clamp(2rem,5vw,3.75rem)] font-extrabold leading-[1] tracking-[-0.035em]">
                {n.title}
              </h1>
            </header>
            {html ? (
              <div
                data-reveal
                className="prose-legal pt-10 text-[16px] [&_img]:my-6 [&_img]:h-auto [&_img]:max-w-full [&_img]:rounded-2xl [&_table]:w-full"
                dangerouslySetInnerHTML={{ __html: html }}
              />
            ) : (
              <p className="pt-10 text-ink-soft">Isi berita belum tersedia.</p>
            )}
            {n.url && (
              <a href={n.url} target="_blank" rel="noopener noreferrer" className="btn btn-ghost mt-10">
                Baca di situs resmi <ArrowUpRight className="h-4 w-4" />
              </a>
            )}
          </>
        )}
      </article>
    </Page>
  );
}
