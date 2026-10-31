/**
 * Versioned download URLs resolve only the matching release asset. The unversioned
 * URL follows stream-latest. Cache entries and outage fallbacks stay version-specific.
 */
export type DownloadEnv = { APP_RELEASE_REPO?: string; UPSTREAM_FETCH?: typeof fetch };
type Ctx = { waitUntil(p: Promise<unknown>): void };

const REPO = "Valzyys/JKT48Connet-REVAMP";
const FIXED_TAG = "stream-latest";
const FIXED_ASSETS = ["JKT48Connect-Stream.apk"];
/** Aset APK rilis di rilis `stream-mobile-build-N` (bukan versi review). */
const BUILD_ASSET = /^JKT48Connect-Stream-v\d+\.\d+\.\d+\.apk$/;
/** Mutable latest is refreshed quickly; exact-version APKs can stay at the edge. */
const FRESH_TTL = 60;
const VERSION_TTL = 86400;
const STALE_TTL = 30 * 86400;

export const STREAM_DOWNLOAD = /^\/download\/jkt48connect-stream(?:-v(\d{1,3}\.\d{1,3}\.\d{1,3}))?\.apk$/i;

/** Nama file unduhan dari tautan: `JKT48Connect-Stream-V1.0.1.apk` atau `JKT48Connect-Stream.apk`. */
function fileName(pathname: string) {
  const version = STREAM_DOWNLOAD.exec(pathname)?.[1];
  return version ? `JKT48Connect-Stream-V${version}.apk` : "JKT48Connect-Stream.apk";
}

type Asset = { name?: string; browser_download_url?: string };
type Release = { tag_name?: string; draft?: boolean; prerelease?: boolean; assets?: Asset[] };

function edgeCache(): Cache | undefined {
  return (globalThis as unknown as { caches?: { default?: Cache } }).caches?.default;
}

const repoOf = (env: DownloadEnv) => (/^[\w.-]+\/[\w.-]+$/.test(env.APP_RELEASE_REPO ?? "") ? env.APP_RELEASE_REPO! : REPO);

/** Cadangan: rilis `stream-mobile-build-N` terbaru lewat API GitHub (bisa kena batas rate). */
async function latestBuildUrl(env: DownloadEnv, version?: string): Promise<{ tag: string; url: string } | null> {
  const res = await (env.UPSTREAM_FETCH ?? fetch)(`https://api.github.com/repos/${repoOf(env)}/releases?per_page=30`, {
    headers: { Accept: "application/vnd.github+json", "User-Agent": "JKT48Connect download", "X-GitHub-Api-Version": "2022-11-28" },
  });
  if (!res.ok) return null;
  const releases = (await res.json()) as Release[];
  for (const r of Array.isArray(releases) ? releases : []) {
    if (r.draft || r.prerelease || !/^stream-mobile-build-\d+$/.test(r.tag_name ?? "")) continue;
    const url = r.assets?.find((a) => version ? a.name === `JKT48Connect-Stream-v${version}.apk` : BUILD_ASSET.test(a.name ?? ""))?.browser_download_url ?? "";
    if (url.startsWith("https://github.com/")) return { tag: r.tag_name!, url };
  }
  return null;
}

/** APK dari GitHub: rilis tetap dulu, lalu rilis build terbaru. */
async function fromGithub(env: DownloadEnv, version?: string): Promise<{ tag: string; res: Response } | null> {
  const get = env.UPSTREAM_FETCH ?? fetch;
  for (const asset of version ? [`JKT48Connect-Stream-v${version}.apk`] : FIXED_ASSETS) {
    const fixed = await get(`https://github.com/${repoOf(env)}/releases/download/${FIXED_TAG}/${asset}`, { redirect: "follow" }).catch(() => null);
    if (fixed?.ok && fixed.body) return { tag: FIXED_TAG, res: fixed };
  }
  const build = await latestBuildUrl(env, version).catch(() => null);
  if (!build) return null;
  const res = await get(build.url, { redirect: "follow" }).catch(() => null);
  return res?.ok && res.body ? { tag: build.tag, res } : null;
}

function apkHeaders(tag: string, length: string | null, maxAge: number, name = "JKT48Connect-Stream.apk") {
  const headers = new Headers({
    "content-type": "application/vnd.android.package-archive",
    "content-disposition": `attachment; filename="${name}"`,
    "cache-control": `public, max-age=${maxAge}`,
    "x-content-type-options": "nosniff",
    "x-stream-build": tag,
  });
  if (length) headers.set("content-length", length);
  return headers;
}

/** Keep browser downloads revalidated; edge freshness is managed separately. */
function served(cached: Response, name: string) {
  const out = new Response(cached.body, cached);
  out.headers.set("cache-control", "public, max-age=0, must-revalidate");
  out.headers.set("content-disposition", `attachment; filename="${name}"`);
  return out;
}

const fail = (status: number, message: string) =>
  new Response(message, { status, headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" } });

export async function handleStreamDownload(request: Request, env: DownloadEnv, ctx: Ctx): Promise<Response> {
  if (request.method !== "GET" && request.method !== "HEAD") return fail(405, "Metode tidak didukung");
  const { origin, pathname } = new URL(request.url);
  const version = STREAM_DOWNLOAD.exec(pathname)?.[1];
  const name = fileName(pathname);
  const ttl = version ? VERSION_TTL : FRESH_TTL;
  const cache = edgeCache();
  // v3 deliberately ignores old shared cache entries that could contain another version.
  const cachePath = `${origin}/__cache/v3/stream-apk/${repoOf(env)}/${version ?? "latest"}`;
  const freshKey = new Request(`${cachePath}/fresh`);
  const staleKey = new Request(`${cachePath}/stale`);
  const head = (r: Response) => (request.method === "HEAD" ? new Response(null, { headers: r.headers }) : r);

  const fresh = await cache?.match(freshKey);
  if (fresh) return head(served(fresh, name));

  const got = await fromGithub(env, version);
  if (!got) {
    const stale = await cache?.match(staleKey);
    return stale ? head(served(stale, name)) : fail(502, "APK JKT48Connect Stream belum bisa diambil. Coba lagi sebentar.");
  }
  const length = got.res.headers.get("content-length");
  const headers = apkHeaders(got.tag, length, FRESH_TTL, name);
  if (!cache) return head(served(new Response(got.res.body, { headers }), name));
  // Satu unduhan dari GitHub: dikirim ke pengguna sekaligus disimpan sebagai salinan terbaru & cadangan.
  const [mine, rest] = got.res.body!.tee();
  const [freshCopy, staleCopy] = rest.tee();
  ctx.waitUntil(cache.put(freshKey, new Response(freshCopy, { headers: apkHeaders(got.tag, length, ttl) })));
  ctx.waitUntil(cache.put(staleKey, new Response(staleCopy, { headers: apkHeaders(got.tag, length, STALE_TTL) })));
  return head(served(new Response(mine, { headers }), name));
}
