/**
 * Unduhan langsung APK JKT48Connect Stream: `GET /download/JKT48Connect-Stream-V1.0.0.apk`.
 *
 * APK diambil dari rilis GitHub Stream terbaru (tag `stream-mobile-build-N`, dibuat workflow
 * stream-mobile-release.yml dan tidak ditandai "latest") lalu dialirkan dari domain ini dengan nama file
 * dan tipe APK yang benar, jadi tautannya tetap sama setiap kali ada build baru.
 */
export type DownloadEnv = { APP_RELEASE_REPO?: string; UPSTREAM_FETCH?: typeof fetch };
type Ctx = { waitUntil(p: Promise<unknown>): void };

const REPO = "Valzyys/JKT48Connet-REVAMP";
const ASSET = "JKT48Connect-Stream-v1.0.0.apk";
const FILENAME = "JKT48Connect-Stream-V1.0.0.apk";
/** Tag rilis terbaru dicek ulang tiap 5 menit; file per tag tidak berubah, jadi disimpan sehari di edge. */
const TAG_TTL = 300;
const FILE_TTL = 86400;

export const STREAM_DOWNLOAD = /^\/download\/jkt48connect-stream-v1\.0\.0\.apk$/i;

type Asset = { name?: string; browser_download_url?: string };
type Release = { tag_name?: string; draft?: boolean; prerelease?: boolean; assets?: Asset[] };

function edgeCache(): Cache | undefined {
  return (globalThis as unknown as { caches?: { default?: Cache } }).caches?.default;
}

/** Rilis Stream terbaru yang punya APK rilis: { tag, url } atau null. */
async function latestStreamApk(env: DownloadEnv): Promise<{ tag: string; url: string } | null> {
  const repo = /^[\w.-]+\/[\w.-]+$/.test(env.APP_RELEASE_REPO ?? "") ? env.APP_RELEASE_REPO! : REPO;
  const res = await (env.UPSTREAM_FETCH ?? fetch)(`https://api.github.com/repos/${repo}/releases?per_page=30`, {
    headers: { Accept: "application/vnd.github+json", "User-Agent": "JKT48Connect download", "X-GitHub-Api-Version": "2022-11-28" },
  });
  if (!res.ok) return null;
  const releases = (await res.json()) as Release[];
  for (const r of Array.isArray(releases) ? releases : []) {
    if (r.draft || r.prerelease || !/^stream-mobile-build-\d+$/.test(r.tag_name ?? "")) continue;
    const url = r.assets?.find((a) => a.name === ASSET)?.browser_download_url ?? "";
    if (url.startsWith("https://github.com/")) return { tag: r.tag_name!, url };
  }
  return null;
}

const fail = (status: number, message: string) =>
  new Response(message, { status, headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" } });

export async function handleStreamDownload(request: Request, env: DownloadEnv, ctx: Ctx): Promise<Response> {
  if (request.method !== "GET" && request.method !== "HEAD") return fail(405, "Metode tidak didukung");
  const origin = new URL(request.url).origin;
  const cache = edgeCache();

  const tagKey = new Request(`${origin}/__cache/v1/stream-apk/latest`);
  let latest = (await (await cache?.match(tagKey))?.json().catch(() => null)) as { tag: string; url: string } | null;
  if (!latest) {
    latest = await latestStreamApk(env).catch(() => null);
    if (!latest) return fail(502, "APK JKT48Connect Stream belum bisa diambil. Coba lagi sebentar.");
    if (cache) ctx.waitUntil(cache.put(tagKey, new Response(JSON.stringify(latest), { headers: { "cache-control": `public, max-age=${TAG_TTL}` } })));
  }

  const fileKey = new Request(`${origin}/__cache/v1/stream-apk/${latest.tag}`);
  let file = await cache?.match(fileKey);
  if (!file) {
    const res = await (env.UPSTREAM_FETCH ?? fetch)(latest.url, { redirect: "follow" });
    if (!res.ok || !res.body) return fail(502, "APK JKT48Connect Stream belum bisa diambil. Coba lagi sebentar.");
    const headers = new Headers({
      "content-type": "application/vnd.android.package-archive",
      "content-disposition": `attachment; filename="${FILENAME}"`,
      "cache-control": `public, max-age=${TAG_TTL}`,
      "x-content-type-options": "nosniff",
      "x-stream-build": latest.tag,
    });
    const length = res.headers.get("content-length");
    if (length) headers.set("content-length", length);
    file = new Response(res.body, { headers });
    if (cache) {
      const [body, copy] = file.body!.tee();
      file = new Response(body, { headers });
      ctx.waitUntil(cache.put(fileKey, new Response(copy, { headers: { ...Object.fromEntries(headers), "cache-control": `public, max-age=${FILE_TTL}` } })));
    }
  } else {
    // Dari cache edge: kembalikan masa simpan klien ke 5 menit supaya build baru cepat terambil.
    file = new Response(file.body, file);
    file.headers.set("cache-control", `public, max-age=${TAG_TTL}`);
  }
  return request.method === "HEAD" ? new Response(null, { headers: file.headers }) : file;
}
