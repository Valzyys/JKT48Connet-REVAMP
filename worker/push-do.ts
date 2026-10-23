import { DurableObject } from "cloudflare:workers";
import { fetchLatestRelease, fetchUpstream, type ProxyEnv } from "./proxy";
import { parseServiceAccount, runPush, type AccessToken, type PushMemory } from "./push";

/**
 * Satu instance (`idFromName("main")`) yang dipanggil cron tiap 2 menit: menyimpan ID yang sudah dikirim
 * dan token akses FCM. Dibuat otomatis oleh `wrangler deploy` lewat `migrations` di wrangler.jsonc.
 * Durable Object juga menjamin putaran tidak berjalan bersamaan (tidak ada notifikasi ganda).
 */
export class PushState extends DurableObject<ProxyEnv> {
  async tick(scheduledTime: number): Promise<{ sent: number; failed: number }> {
    const sa = parseServiceAccount(this.env.FCM_SERVICE_ACCOUNT);
    if (!sa) return { sent: 0, failed: 0 };
    const [memory, token] = await Promise.all([this.ctx.storage.get<PushMemory>("memory"), this.ctx.storage.get<AccessToken>("token")]);
    const res = await runPush({
      sa,
      memory: memory ?? {},
      token,
      now: Date.now(),
      heavy: new Date(scheduledTime).getUTCMinutes() % 10 === 0,
      fetchers: {
        upstream: async (path) => {
          const got = await fetchUpstream(path, this.env);
          return got.ok ? got.data : null;
        },
        latestRelease: () => fetchLatestRelease(this.env),
      },
    });
    await this.ctx.storage.put({ memory: res.memory, ...(res.token ? { token: res.token } : {}) });
    if (res.sent || res.failed) console.log("push", res);
    return { sent: res.sent, failed: res.failed };
  }

  /** Lupakan semua yang sudah dikirim (putaran berikutnya hanya mencatat ulang, tanpa mengirim). */
  async reset() {
    await this.ctx.storage.deleteAll();
  }
}
