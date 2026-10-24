import { DurableObject } from "cloudflare:workers";
import { fetchLatestRelease, fetchUpstream, type ProxyEnv } from "./proxy";
import { LIVE_INTERVAL_MS, parseServiceAccount, runPush, type AccessToken, type PushMemory } from "./push";

/**
 * Satu instance (`idFromName("main")`) yang menyimpan ID yang sudah dikirim dan token akses FCM.
 * Dibuat otomatis oleh `wrangler deploy` lewat `migrations` di wrangler.jsonc.
 *
 * - Alarm Durable Object berulang tiap LIVE_INTERVAL_MS (15 detik): cek member yang mulai live → push hampir realtime.
 *   (Cron Cloudflare paling cepat per menit, jadi alarm yang dipakai untuk live.)
 * - Cron tiap 2 menit: jadwal/ultah/berita/update tiap 10 menit, sekaligus menyalakan ulang alarm bila berhenti.
 * Putaran dijalankan berurutan (antrean di bawah), jadi cron dan alarm tidak pernah mengirim notifikasi ganda.
 */
export class PushState extends DurableObject<ProxyEnv> {
  private queue: Promise<unknown> = Promise.resolve();

  async tick(scheduledTime: number): Promise<{ sent: number; failed: number }> {
    await this.armAlarm();
    return this.enqueue(new Date(scheduledTime).getUTCMinutes() % 10 === 0);
  }

  async alarm() {
    if (!parseServiceAccount(this.env.FCM_SERVICE_ACCOUNT)) return; // push dimatikan → alarm berhenti
    // Jadwalkan putaran berikutnya dulu, supaya error di putaran ini tidak memutus rantai alarm.
    await this.ctx.storage.setAlarm(Date.now() + LIVE_INTERVAL_MS);
    await this.enqueue(false);
  }

  private async armAlarm() {
    if (!parseServiceAccount(this.env.FCM_SERVICE_ACCOUNT)) return;
    if ((await this.ctx.storage.getAlarm()) == null) await this.ctx.storage.setAlarm(Date.now() + LIVE_INTERVAL_MS);
  }

  private enqueue(heavy: boolean): Promise<{ sent: number; failed: number }> {
    const job = this.queue.then(() => this.round(heavy));
    this.queue = job.catch(() => {});
    return job;
  }

  private async round(heavy: boolean): Promise<{ sent: number; failed: number }> {
    const sa = parseServiceAccount(this.env.FCM_SERVICE_ACCOUNT);
    if (!sa) return { sent: 0, failed: 0 };
    const [memory, token] = await Promise.all([this.ctx.storage.get<PushMemory>("memory"), this.ctx.storage.get<AccessToken>("token")]);
    const res = await runPush({
      sa,
      memory: memory ?? {},
      token,
      now: Date.now(),
      heavy,
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
