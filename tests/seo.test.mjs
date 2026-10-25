import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { build } from "esbuild";

const scratch = await mkdtemp(join(tmpdir(), "jkc-seo-test-"));
await build({ entryPoints: ["worker/seo.ts"], bundle: true, platform: "node", format: "esm", external: ["cloudflare:*"], outfile: join(scratch, "seo.mjs"), logLevel: "silent" });
const { buildMeta, handleRobots, handleSitemap, isPage, siteOrigin } = await import(join(scratch, "seo.mjs"));
test.after(() => rm(scratch, { recursive: true, force: true }));

// Upstream tiruan: format mentah yang sama dengan api.jkt48connect.app (dibentuk oleh src/lib/shape.ts).
const RAW = {
  "/api/member": [
    { url: "aurellia", name: "Aurellia", nickname: "Lia", img: "https://img.test/aurellia.jpg" },
    { url: "freya-jayawardana", name: "Freya Jayawardana", nickname: "Freya", img: "https://img.test/freya.jpg" },
  ],
  "/api/member/aurellia": { url: "aurellia", name: "Aurellia", nickname: "Lia", fullname: "Aurellia", birthdate: "2005-10-22T17:00:00.000Z", height: "160 cm", img: "https://img.test/aurellia.jpg", socials: [{ title: "X", url: "https://x.com/lia" }] },
  "/api/news/123": { id: "123", title: "Pengumuman Show Spesial", date: "2026-10-20T03:00:00.000Z", category: "Event", content: '<p>Halo <b>fans</b>!</p><img src="https://jkt48.com/a.jpg"><script>x()</script>' },
};
const env = {
  JKT48CONNECT_API_KEY: "k",
  UPSTREAM_FETCH: async (input) => {
    const url = new URL(String(input));
    // Daftar berhalaman (theater/news/recent) kosong; sisanya dari RAW, selain itu 404.
    if (url.searchParams.has("page")) return Response.json({ total: 0, theater: [], news: [], recents: [] });
    const body = RAW[url.pathname];
    return body ? Response.json(body) : new Response("not found", { status: 404 });
  },
};
const ctx = { waitUntil() {} };
const ORIGIN = "https://jkt48connect.test";

test("only real SPA routes go through the SEO layer", () => {
  for (const p of ["/", "/live", "/member", "/member/aurellia", "/theater/SH5538", "/news/123", "/recent/idn-1", "/about"]) assert.ok(isPage(p), p);
  for (const p of ["/api/member", "/pm", "/pm/login", "/member/a/b", "/assets/x.js", "/member/../etc", "/nope"]) assert.ok(!isPage(p), p);
});

test("canonical origin can be pinned with SITE_URL (https only)", () => {
  const req = new Request("https://jkt48connet-revamp.workers.dev/live");
  assert.equal(siteOrigin(req, {}), "https://jkt48connet-revamp.workers.dev");
  assert.equal(siteOrigin(req, { SITE_URL: "https://jkt48connect.test" }), "https://jkt48connect.test");
  assert.equal(siteOrigin(req, { SITE_URL: "http://insecure.test" }), "https://jkt48connet-revamp.workers.dev");
});

test("static pages get their own title and description; the member index links every member", async () => {
  const home = await buildMeta("/", env, ctx, ORIGIN);
  assert.match(home.title, /^JKT48Connect — /);
  const live = await buildMeta("/live", env, ctx, ORIGIN);
  assert.equal(live.title, "Member JKT48 yang Sedang Live di IDN & Showroom | JKT48Connect");
  const members = await buildMeta("/member", env, ctx, ORIGIN);
  assert.match(members.body, /href="\/member\/aurellia">Aurellia \(Lia\)</);
  assert.match(members.body, /href="\/member\/freya-jayawardana"/);
});

test("member pages: profile title, Person data, and a real 404 for unknown members", async () => {
  const m = await buildMeta("/member/aurellia", env, ctx, ORIGIN);
  assert.equal(m.status, 200);
  assert.equal(m.title, "Aurellia (Lia) — Profil Member JKT48 | JKT48Connect");
  assert.match(m.description, /lahir 23 Oktober 2005/, "birth date in WIB");
  assert.ok(m.description.length <= 160);
  const person = m.ld[0].mainEntity;
  assert.equal(person["@type"], "Person");
  assert.equal(person.birthDate, "2005-10-23");
  assert.deepEqual(person.sameAs, ["https://x.com/lia"]);
  assert.equal(m.ld[1]["@type"], "BreadcrumbList");
  assert.equal(m.ld[1].itemListElement[2].item, `${ORIGIN}/member/aurellia`);

  const missing = await buildMeta("/member/tidak-ada", env, ctx, ORIGIN);
  assert.equal(missing.status, 404);
});

test("news pages: text-only description (no HTML/script) and NewsArticle data", async () => {
  const n = await buildMeta("/news/123", env, ctx, ORIGIN);
  assert.equal(n.title, "Pengumuman Show Spesial — Berita JKT48 | JKT48Connect");
  assert.equal(n.description, "Halo fans !");
  assert.equal(n.image, "https://jkt48.com/a.jpg");
  assert.equal(n.ld[0]["@type"], "NewsArticle");
  assert.ok(!JSON.stringify(n).includes("<script"), "no markup leaks into meta");
});

test("an upstream outage keeps detail pages indexable (200 with section meta), not 404", async () => {
  const down = { ...env, UPSTREAM_FETCH: async () => new Response("boom", { status: 502 }) };
  const t = await buildMeta("/theater/SH1", down, ctx, ORIGIN);
  assert.equal(t.status, 200);
  assert.match(t.title, /Jadwal Theater JKT48/);
});

test("robots.txt and sitemap.xml", async () => {
  const robots = await handleRobots(new Request(`${ORIGIN}/robots.txt`), {}).text();
  assert.match(robots, /Disallow: \/api\//);
  assert.match(robots, /Disallow: \/pm/);
  assert.match(robots, new RegExp(`Sitemap: ${ORIGIN}/sitemap.xml`));

  const res = await handleSitemap(new Request(`${ORIGIN}/sitemap.xml`), env, ctx);
  assert.match(res.headers.get("content-type"), /application\/xml/);
  const xml = await res.text();
  assert.match(xml, /^<\?xml/);
  assert.match(xml, new RegExp(`<loc>${ORIGIN}/</loc>`));
  assert.match(xml, new RegExp(`<loc>${ORIGIN}/live</loc>`));
  assert.match(xml, new RegExp(`<loc>${ORIGIN}/member/aurellia</loc>`));
  assert.ok(!xml.includes("/pm"), "private pages are not listed");
});
