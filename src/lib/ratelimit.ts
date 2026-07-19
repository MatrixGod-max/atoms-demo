/** In-memory sliding-window rate limiter (single-process deployment). */

const store = new Map<string, number[]>();

function sweep() {
  const cutoff = Date.now() - 24 * 3600 * 1000;
  for (const [key, times] of store) {
    const kept = times.filter((t) => t > cutoff);
    if (kept.length === 0) store.delete(key);
    else store.set(key, kept);
  }
}

const g = globalThis as unknown as { __quarkRlSweep?: ReturnType<typeof setInterval> };
if (!g.__quarkRlSweep) g.__quarkRlSweep = setInterval(sweep, 10 * 60_000);

export function rateLimit(key: string, limit: number, windowMs: number): { ok: boolean; retryAfterSec: number } {
  const nowTs = Date.now();
  const times = (store.get(key) ?? []).filter((t) => t > nowTs - windowMs);
  if (times.length >= limit) {
    return { ok: false, retryAfterSec: Math.ceil((times[0] + windowMs - nowTs) / 1000) };
  }
  times.push(nowTs);
  store.set(key, times);
  return { ok: true, retryAfterSec: 0 };
}

export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  return fwd ? fwd.split(",")[0].trim() : "local";
}
