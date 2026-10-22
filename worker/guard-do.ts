import { DurableObject } from "cloudflare:workers";
import { applyStrike, emptyState, verdictOf, type GuardState, type Reason, type Verdict } from "./guard";

/**
 * Durable Object penyimpan poin curiga & blokir, satu instance per IP (`idFromName("ip:…")`).
 * Dibuat otomatis oleh `wrangler deploy` lewat `migrations` di wrangler.jsonc (tanpa setup manual).
 */
export class Guard extends DurableObject {
  private async load(): Promise<GuardState> {
    return (await this.ctx.storage.get<GuardState>("s")) ?? emptyState();
  }

  async status(): Promise<Verdict> {
    return verdictOf(await this.load(), Date.now());
  }

  async strike(reason: Reason): Promise<Verdict> {
    const next = applyStrike(await this.load(), reason, Date.now());
    await this.ctx.storage.put("s", next);
    // Bersihkan state setelah 8 hari tanpa aktivitas.
    await this.ctx.storage.setAlarm(Date.now() + 8 * 24 * 60 * 60_000);
    return verdictOf(next, Date.now());
  }

  async alarm() {
    await this.ctx.storage.deleteAll();
  }
}
