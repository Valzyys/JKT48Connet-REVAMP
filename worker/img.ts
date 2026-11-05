/**
 * /img?u=<url>&w=<lebar>: gambar dari media JKT48Connect diperkecil di edge (WebP/AVIF sesuai Accept) bila
 * Cloudflare Image Transformations aktif untuk zona ini; bila belum aktif, gambar asli disajikan apa adanya
 * sehingga tidak ada gambar yang rusak. Hanya host media sendiri yang diizinkan (bukan proxy terbuka).
 */
const ALLOWED_HOSTS = new Set(["api.jkt48connect.app"]);
const WIDTHS = [160, 320, 480, 640, 960, 1280];

export const IMG_PATH = "/img";

export async function handleImg(request: Request): Promise<Response> {
  const url = new URL(request.url);
  let src: URL;
  try {
    src = new URL(url.searchParams.get("u") ?? "");
  } catch {
    return new Response("Bad Request", { status: 400 });
  }
  if (src.protocol !== "https:" || !ALLOWED_HOSTS.has(src.hostname)) return new Response("Forbidden", { status: 403 });
  const asked = Number(url.searchParams.get("w")) || 640;
  const width = WIDTHS.find((w) => w >= asked) ?? WIDTHS[WIDTHS.length - 1];
  const accept = request.headers.get("accept") ?? "";
  const format = accept.includes("image/avif") ? "avif" : accept.includes("image/webp") ? "webp" : undefined;

  const resized = await fetch(src.toString(), {
    cf: { image: { width, fit: "scale-down", quality: 75, ...(format ? { format } : {}) }, cacheEverything: true, cacheTtl: 86400 },
  } as RequestInit).catch(() => null);
  // Transformations belum aktif / gagal → gambar asli.
  const res =
    resized && resized.ok && (resized.headers.get("content-type") ?? "").startsWith("image/")
      ? resized
      : await fetch(src.toString(), { cf: { cacheEverything: true, cacheTtl: 86400 } } as RequestInit).catch(() => null);
  if (!res) return new Response("Bad Gateway", { status: 502 });
  if (!res.ok) return new Response(null, { status: res.status });
  const headers = new Headers({ "content-type": res.headers.get("content-type") ?? "image/png", "cache-control": "public, max-age=86400, immutable", vary: "Accept" });
  return new Response(res.body, { status: 200, headers });
}
