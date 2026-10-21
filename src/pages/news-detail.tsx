import { useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import DOMPurify from "dompurify";
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
      <article className="container-x max-w-3xl pt-6">
        <BackLink to="/news" label="Semua berita" />
        {news.isError ? (
          <div className="pt-8">
            <ErrorState error={news.error} onRetry={() => news.refetch()} />
          </div>
        ) : !n ? (
          <div className="space-y-4 pt-8">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        ) : (
          <>
            <header data-reveal className="border-b-2 border-brand pb-5 pt-6">
              <p className="num text-ink-soft">
                {n.category} · {fmtDate(n.date, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
              </p>
              <h1 className="mt-2 text-[clamp(1.75rem,4.5vw,2.75rem)] font-bold leading-[1.1] tracking-tight">{n.title}</h1>
            </header>
            {html ? (
              <div
                data-reveal
                className="prose-body pt-6 text-[16px] [&_img]:my-5 [&_img]:h-auto [&_img]:max-w-full [&_img]:rounded-2xl [&_table]:w-full"
                dangerouslySetInnerHTML={{ __html: html }}
              />
            ) : (
              <p className="pt-6 text-ink-soft">Isi berita belum tersedia.</p>
            )}
            {n.url && (
              <p className="mt-8 border-t border-line pt-4">
                <a href={n.url} target="_blank" rel="noopener noreferrer" className="link-arrow">
                  Baca di jkt48.com →
                </a>
              </p>
            )}
          </>
        )}
      </article>
    </Page>
  );
}
