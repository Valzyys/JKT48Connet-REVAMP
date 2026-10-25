/**
 * SEO untuk situs SPA: HTML awal tiap URL diberi judul, deskripsi, canonical, Open Graph/Twitter card,
 * data terstruktur (JSON-LD), dan navigasi HTML biasa di <noscript>, sehingga crawler mendapat isi yang benar
 * tanpa menjalankan JavaScript. Juga menyajikan /robots.txt dan /sitemap.xml.
 *
 * Data member/theater/berita diambil dari upstream (key tetap di worker) dan di-cache di edge 1 jam;
 * URL rekaman replay tidak pernah ikut ke HTML.
 */
import { clip, fullTitle, SITE_DESCRIPTION, SITE_NAME, STATIC_PAGES } from "../src/lib/seo";
import {
  shapeMember,
  shapeMembers,
  shapeNews,
  shapeNewsList,
  shapeRecent,
  shapeRecentList,
  shapeTheater,
  shapeTheaterList,
} from "../src/lib/shape";
import { fetchUpstream, type ProxyEnv } from "./proxy";

export interface SeoEnv extends ProxyEnv {
  ASSETS: Fetcher;
  /** Opsional: alamat utama situs (mis. https://jkt48connect.my.id) untuk canonical & sitemap bila situs punya beberapa domain. */
  SITE_URL?: string;
}

type Ctx = { waitUntil(p: Promise<unknown>): void };

const DETAIL = /^\/(member|theater|news|recent)\/([A-Za-z0-9_-][A-Za-z0-9._-]{0,99})$/;
const SECTION: Record<string, { path: string; label: string }> = {
  member: { path: "/member", label: "Member" },
  theater: { path: "/theater", label: "Theater" },
  news: { path: "/news", label: "Berita" },
  recent: { path: "/recent", label: "Recent" },
};
const PAGE_TTL = 3600;
const SITEMAP_TTL = 6 * 3600;
const JKT48 = { "@type": "MusicGroup", name: "JKT48", url: "https://jkt48.com" };
const THEATER_PLACE = {
  "@type": "Place",
  name: "JKT48 Theater",
  address: {
    "@type": "PostalAddress",
    streetAddress: "fX Sudirman Lt. 4, Jl. Jenderal Sudirman Pintu Satu Senayan",
    addressLocality: "Jakarta",
    postalCode: "10270",
    addressCountry: "ID",
  },
};
const SAME_AS = ["https://x.com/JKT48Connect", "https://discord.com/discovery/applications/1305141693477027891", "https://github.com/JKT48Connect"];

/** Rute halaman yang dilayani SPA (di luar /api dan /pm). */
export function isPage(path: string): boolean {
  return Object.hasOwn(STATIC_PAGES, path) || DETAIL.test(path);
}

export function siteOrigin(request: Request, env: SeoEnv): string {
  try {
    const u = new URL(env.SITE_URL ?? "");
    if (u.protocol === "https:") return u.origin;
  } catch {
    /* pakai origin permintaan */
  }
  return new URL(request.url).origin;
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const ld = (data: unknown) => `<script type="application/ld+json">${JSON.stringify(data).replace(/</g, "\\u003c")}</script>`;
const wib = (iso: string, withTime = true) => {
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return "";
  return new Intl.DateTimeFormat("id-ID", { timeZone: "Asia/Jakarta", dateStyle: "long", ...(withTime ? { timeStyle: "short" } : {}) }).format(ms) + (withTime ? " WIB" : "");
};
const ymd = (iso: string) => {
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? new Date(ms + 7 * 3600_000).toISOString().slice(0, 10) : "";
};
const textOf = (html: string) =>
  html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
const platformLabel = (p: string) => (p === "idn" ? "IDN Live" : p === "showroom" ? "Showroom" : p);

/** JSON upstream lewat cache edge; `missing` = upstream menjawab 404 (halaman tidak ada). */
async function upstream(env: SeoEnv, ctx: Ctx, origin: string, path: string, ttl = PAGE_TTL): Promise<{ data: unknown; missing: boolean }> {
  const cache = (globalThis as unknown as { caches?: { default?: Cache } }).caches?.default;
  const key = new Request(`${origin}/__cache/seo-v1${path}`);
  const hit = await cache?.match(key);
  if (hit) return { data: await hit.json(), missing: false };
  const got = await fetchUpstream(path, env);
  if (!got.ok) return { data: null, missing: got.status === 404 };
  if (cache) ctx.waitUntil(cache.put(key, new Response(JSON.stringify(got.data), { headers: { "content-type": "application/json", "cache-control": `public, max-age=${ttl}` } })));
  return { data: got.data, missing: false };
}

type Built = {
  status: number;
  title: string;
  description: string;
  h1: string;
  image?: string;
  ogType: string;
  ld: unknown[];
  /** HTML tambahan untuk <noscript> (sudah di-escape). */
  body: string;
};

/** Meta untuk satu URL (diekspor untuk tes). */
export async function buildMeta(path: string, env: SeoEnv, ctx: Ctx, origin: string): Promise<Built> {
  const page = STATIC_PAGES[path];
  if (page) {
    const built: Built = { status: 200, title: fullTitle(page.title), description: page.description, h1: page.h1, ogType: "website", ld: [], body: "" };
    // Daftar tautan ke halaman detail: tautan internal yang bisa diikuti crawler tanpa JavaScript.
    if (path === "/member") {
      const { data } = await upstream(env, ctx, origin, "/api/member");
      const list = data ? shapeMembers(data) : [];
      built.body = links(list.map((m) => [`/member/${m.id}`, m.nickname ? `${m.name} (${m.nickname})` : m.name]));
    } else if (path === "/theater") {
      const { data } = await upstream(env, ctx, origin, "/api/theater?page=1&perpage=24");
      const list = data ? shapeTheaterList(data as never, 1, 24).items : [];
      built.body = links(list.map((s) => [`/theater/${s.id}`, `${s.title} — ${wib(s.date)}`]));
    } else if (path === "/news") {
      const { data } = await upstream(env, ctx, origin, "/api/news?page=1&perpage=20");
      const list = data ? shapeNewsList(data as never, 1, 20).items : [];
      built.body = links(list.map((n) => [`/news/${n.id}`, n.title]));
    }
    return built;
  }

  const [, kind, id] = DETAIL.exec(path)!;
  const section = SECTION[kind];
  const crumbs = (name: string) => ({
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Beranda", item: `${origin}/` },
      { "@type": "ListItem", position: 2, name: section.label, item: `${origin}${section.path}` },
      { "@type": "ListItem", position: 3, name, item: `${origin}${path}` },
    ],
  });
  const notFound: Built = {
    status: 404,
    title: fullTitle("Halaman tidak ditemukan"),
    description: SITE_DESCRIPTION,
    h1: "Halaman tidak ditemukan",
    ogType: "website",
    ld: [],
    body: "",
  };
  const { data, missing } = await upstream(env, ctx, origin, `/api/${kind}/${encodeURIComponent(id)}`);
  if (missing) return notFound;
  if (!data) {
    // Upstream sedang bermasalah: tetap 200 dengan meta umum bagian itu, jangan sampai halaman dianggap hilang.
    const base = STATIC_PAGES[section.path];
    return { status: 200, title: fullTitle(base.title), description: base.description, h1: base.h1, ogType: "website", ld: [], body: "" };
  }

  if (kind === "member") {
    const m = shapeMember(data as never, id);
    if (!m.name) return notFound;
    const facts = [m.birthdate && `lahir ${wib(m.birthdate, false)}`, m.height && `tinggi ${m.height}`, m.bloodType && `golongan darah ${m.bloodType}`].filter(Boolean).join(", ");
    const name = m.nickname && m.nickname !== m.name ? `${m.name} (${m.nickname})` : m.name;
    return {
      status: 200,
      title: fullTitle(`${name} — Profil Member JKT48`),
      description: clip(`Profil ${m.fullname || m.name} JKT48${m.isGraduate ? " (lulus)" : ""}${facts ? `: ${facts}` : ""}. Lihat jadwal theater, live IDN & Showroom terbaru, dan sosial media.`),
      h1: m.fullname || m.name,
      image: m.img,
      ogType: "profile",
      ld: [
        {
          "@context": "https://schema.org",
          "@type": "ProfilePage",
          mainEntity: {
            "@type": "Person",
            name: m.fullname || m.name,
            ...(m.nickname ? { alternateName: m.nickname } : {}),
            ...(m.img ? { image: m.img } : {}),
            ...(ymd(m.birthdate) ? { birthDate: ymd(m.birthdate) } : {}),
            ...(m.isGraduate ? { alumniOf: JKT48 } : { memberOf: JKT48 }),
            ...(m.socials.length ? { sameAs: m.socials.map((s) => s.url) } : {}),
          },
        },
        crumbs(m.name),
      ],
      body: `<p>${esc(facts)}</p>${m.jikosokai ? `<blockquote>${esc(m.jikosokai)}</blockquote>` : ""}${links(m.upcomingShows.map((s) => [`/theater/${s.id}`, `${s.title} — ${wib(s.date)}`]))}`,
    };
  }

  if (kind === "theater") {
    const s = shapeTheater(data as never, id);
    if (!s.title) return notFound;
    const lineup = s.members.map((m) => m.name);
    const when = wib(s.date);
    const isShow = s.category === "show" || !s.category;
    return {
      status: 200,
      title: fullTitle(`${s.title}${when ? ` — ${when}` : ""} · Show Theater JKT48`),
      description: clip(
        `Show theater JKT48 "${s.title}"${when ? ` pada ${when}` : ""}.${lineup.length ? ` Member tampil: ${lineup.slice(0, 10).join(", ")}${lineup.length > 10 ? ", dan lainnya" : ""}.` : ""}${s.songs.length ? ` Setlist ${s.songs.length} lagu.` : ""}`,
      ),
      h1: s.title,
      image: s.banner || s.poster,
      ogType: "website",
      ld: [
        ...(isShow && Number.isFinite(Date.parse(s.date))
          ? [
              {
                "@context": "https://schema.org",
                "@type": "Event",
                name: `JKT48 Theater: ${s.title}`,
                startDate: new Date(Date.parse(s.date)).toISOString(),
                eventStatus: "https://schema.org/EventScheduled",
                eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
                location: THEATER_PLACE,
                ...(s.banner || s.poster ? { image: [s.banner || s.poster] } : {}),
                description: `Show theater JKT48 ${s.title}${s.team ? ` (${s.team})` : ""}.`,
                organizer: { "@type": "Organization", name: "JKT48", url: "https://jkt48.com" },
                ...(lineup.length ? { performer: lineup.map((name) => ({ "@type": "Person", name })) } : { performer: JKT48 }),
              },
            ]
          : []),
        crumbs(s.title),
      ],
      body: `<p>${esc(when)}</p>${links(s.members.map((m) => [`/member/${m.id}`, m.name]))}${s.songs.length ? `<ol>${s.songs.map((t) => `<li>${esc(t)}</li>`).join("")}</ol>` : ""}`,
    };
  }

  if (kind === "news") {
    const n = shapeNews(data as never, id);
    if (!n.title) return notFound;
    const text = textOf(n.content);
    const img = /<img[^>]+(?:data-src|src)="([^"]+)"/i.exec(n.content)?.[1];
    return {
      status: 200,
      title: fullTitle(`${n.title} — Berita JKT48`),
      description: clip(text || `${n.category} JKT48: ${n.title}`),
      h1: n.title,
      image: img?.startsWith("http") ? img : undefined,
      ogType: "article",
      ld: [
        {
          "@context": "https://schema.org",
          "@type": "NewsArticle",
          headline: clip(n.title, 110),
          ...(Number.isFinite(Date.parse(n.date)) ? { datePublished: new Date(Date.parse(n.date)).toISOString() } : {}),
          author: { "@type": "Organization", name: "JKT48", url: "https://jkt48.com" },
          publisher: { "@type": "Organization", name: SITE_NAME, logo: { "@type": "ImageObject", url: `${origin}/icon-512.png` } },
          mainEntityOfPage: `${origin}${path}`,
          ...(n.url ? { isBasedOn: n.url } : {}),
        },
        crumbs(n.title),
      ],
      body: `<p>${esc(wib(n.date, false))}</p><p>${esc(clip(text, 600))}</p>`,
    };
  }

  // recent: hanya field aman (nama, platform, waktu, penonton) — tanpa URL rekaman.
  const r = shapeRecent(data as never, id);
  if (!r.name) return notFound;
  const when = wib(r.start);
  return {
    status: 200,
    title: fullTitle(`Rekap Live ${r.name} di ${platformLabel(r.platform)}${when ? ` — ${when}` : ""}`),
    description: clip(
      `${r.name} live di ${platformLabel(r.platform)}${when ? ` pada ${when}` : ""}${r.viewers ? ` dengan ${r.viewers.toLocaleString("id-ID")} penonton` : ""}. Lihat gift, top supporter, cuplikan layar, dan replay.`,
    ),
    h1: `Rekap live ${r.name}`,
    image: r.img,
    ogType: "website",
    ld: [crumbs(`Live ${r.name}`)],
    body: r.memberId ? links([[`/member/${r.memberId}`, `Profil ${r.name}`]]) : "",
  };
}

function links(items: [string, string][]): string {
  return items.length ? `<ul>${items.map(([href, label]) => `<li><a href="${esc(href)}">${esc(label)}</a></li>`).join("")}</ul>` : "";
}

/** Halaman SPA dengan meta & data terstruktur yang sesuai URL. */
export async function handlePage(request: Request, env: SeoEnv, ctx: Ctx): Promise<Response> {
  const url = new URL(request.url);
  const origin = siteOrigin(request, env);
  const shell = await env.ASSETS.fetch(new Request(new URL("/", url), { headers: request.headers }));
  if (!shell.ok || !(shell.headers.get("content-type") ?? "").includes("text/html")) return shell;

  let b: Built;
  try {
    b = await buildMeta(url.pathname, env, ctx, origin);
  } catch (err) {
    console.error("seo", url.pathname, err);
    b = { status: 200, title: fullTitle(STATIC_PAGES["/"].title), description: SITE_DESCRIPTION, h1: SITE_NAME, ogType: "website", ld: [], body: "" };
  }
  const canonical = `${origin}${url.pathname === "/" ? "/" : url.pathname}`;
  const image = b.image || `${origin}/og.png`;
  const head = [
    `<link rel="canonical" href="${esc(canonical)}">`,
    b.status === 404 ? `<meta name="robots" content="noindex">` : `<meta name="robots" content="index, follow, max-image-preview:large">`,
    `<meta property="og:site_name" content="${SITE_NAME}">`,
    `<meta property="og:locale" content="id_ID">`,
    `<meta property="og:type" content="${b.ogType}">`,
    `<meta property="og:title" content="${esc(b.title)}">`,
    `<meta property="og:description" content="${esc(b.description)}">`,
    `<meta property="og:url" content="${esc(canonical)}">`,
    `<meta property="og:image" content="${esc(image)}">`,
    `<meta name="twitter:card" content="summary_large_image">`,
    `<meta name="twitter:site" content="@JKT48Connect">`,
    `<meta name="twitter:title" content="${esc(b.title)}">`,
    `<meta name="twitter:description" content="${esc(b.description)}">`,
    `<meta name="twitter:image" content="${esc(image)}">`,
    ld({
      "@context": "https://schema.org",
      "@graph": [
        { "@type": "WebSite", "@id": `${origin}/#website`, name: SITE_NAME, alternateName: ["JKT48 Connect", "jkt48connect"], url: `${origin}/`, inLanguage: "id-ID", publisher: { "@id": `${origin}/#org` } },
        { "@type": "Organization", "@id": `${origin}/#org`, name: SITE_NAME, url: `${origin}/`, logo: `${origin}/icon-512.png`, sameAs: SAME_AS },
      ],
    }),
    ...b.ld.map(ld),
  ].join("");
  const nav = Object.entries(STATIC_PAGES)
    .filter(([, p]) => p.nav)
    .map(([href, p]) => `<a href="${href}">${esc(p.nav!)}</a>`)
    .join(" · ");
  const noscript = `<noscript><header><a href="/">${SITE_NAME}</a><nav>${nav}</nav></header><main><h1>${esc(b.h1)}</h1><p>${esc(b.description)}</p>${b.body}</main></noscript>`;

  const headers = new Headers(shell.headers);
  headers.delete("etag");
  headers.delete("content-length");
  return new HTMLRewriter()
    .on("title", { element: (e) => void e.setInnerContent(b.title) })
    .on('meta[name="description"]', { element: (e) => void e.setAttribute("content", b.description) })
    .on('meta[property^="og:"]', { element: (e) => void e.remove() })
    .on('meta[name^="twitter:"]', { element: (e) => void e.remove() })
    .on("head", { element: (e) => void e.append(head, { html: true }) })
    .on("body", { element: (e) => void e.append(noscript, { html: true }) })
    .transform(new Response(shell.body, { status: b.status, headers }));
}

export function handleRobots(request: Request, env: SeoEnv): Response {
  const origin = siteOrigin(request, env);
  const body = ["User-agent: *", "Allow: /", "Disallow: /api/", "Disallow: /pm", "", `Sitemap: ${origin}/sitemap.xml`, ""].join("\n");
  return new Response(body, { headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "public, max-age=3600" } });
}

/** Sitemap: halaman statis + semua member + show theater, berita, dan rekap live terbaru. */
export async function handleSitemap(request: Request, env: SeoEnv, ctx: Ctx): Promise<Response> {
  const origin = siteOrigin(request, env);
  const entries: { loc: string; lastmod?: string; priority: string }[] = Object.keys(STATIC_PAGES).map((p) => ({
    loc: p,
    priority: p === "/" ? "1.0" : ["/disclaimer", "/terms", "/privacy"].includes(p) ? "0.2" : "0.8",
  }));
  const settle = async <T>(p: Promise<T>) => {
    try {
      return await p;
    } catch {
      return null;
    }
  };
  const [members, theaters, news, recents] = await Promise.all([
    settle(upstream(env, ctx, origin, "/api/member", SITEMAP_TTL)),
    settle(Promise.all([1, 2, 3].map((p) => upstream(env, ctx, origin, `/api/theater?page=${p}&perpage=40`, SITEMAP_TTL)))),
    settle(Promise.all([1, 2, 3].map((p) => upstream(env, ctx, origin, `/api/news?page=${p}&perpage=40`, SITEMAP_TTL)))),
    settle(upstream(env, ctx, origin, "/api/recent?page=1&perpage=40", SITEMAP_TTL)),
  ]);
  if (members?.data) for (const m of shapeMembers(members.data)) entries.push({ loc: `/member/${m.id}`, priority: m.isGraduate ? "0.5" : "0.7" });
  for (const [i, t] of (theaters ?? []).entries())
    if (t.data) for (const s of shapeTheaterList(t.data as never, i + 1, 40).items) entries.push({ loc: `/theater/${s.id}`, lastmod: ymd(s.date), priority: "0.6" });
  for (const [i, n] of (news ?? []).entries())
    if (n.data) for (const a of shapeNewsList(n.data as never, i + 1, 40).items) entries.push({ loc: `/news/${a.id}`, lastmod: ymd(a.date), priority: "0.6" });
  if (recents?.data) for (const r of shapeRecentList(recents.data as never, 1, 40).items) entries.push({ loc: `/recent/${r.id}`, lastmod: ymd(r.start), priority: "0.4" });

  const seen = new Set<string>();
  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...entries
      .filter((e) => DETAIL.test(e.loc) || Object.hasOwn(STATIC_PAGES, e.loc))
      .filter((e) => !seen.has(e.loc) && seen.add(e.loc))
      .map((e) => `<url><loc>${esc(origin + e.loc)}</loc>${e.lastmod ? `<lastmod>${e.lastmod}</lastmod>` : ""}<priority>${e.priority}</priority></url>`),
    "</urlset>",
  ].join("\n");
  return new Response(xml, { headers: { "content-type": "application/xml; charset=utf-8", "cache-control": "public, max-age=3600" } });
}
