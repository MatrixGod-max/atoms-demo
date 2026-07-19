import { randomBytes } from "node:crypto";
import { db, now } from "./db";
import type { GenerationMode } from "./models";

export const SIGNUP_BONUS = 20;
export const BANNER_BONUS = 26;

/** Credit price of one generation, Atoms-style: heavier thinking costs more. */
export function generationCost(mode: GenerationMode, research: boolean, team: boolean): number {
  const base = mode === "deep" ? 5 : mode === "mixed" ? 3 : 1;
  return base + (research ? 1 : 0) + (team ? 1 : 0);
}

export function balance(userId: string): number {
  const row = db.prepare("SELECT credits FROM users WHERE id = ?").get(userId) as { credits: number } | undefined;
  return row?.credits ?? 0;
}

export function recordEvent(userId: string, delta: number, reason: string): void {
  db.prepare("UPDATE users SET credits = credits + ? WHERE id = ?").run(delta, userId);
  db.prepare("INSERT INTO credit_events (id, user_id, delta, reason, created_at) VALUES (?, ?, ?, ?, ?)").run(
    `ce_${randomBytes(8).toString("base64url")}`,
    userId,
    delta,
    reason,
    now()
  );
}

/** Atomically deduct; returns false when the balance is insufficient. */
export function charge(userId: string, amount: number, reason: string): boolean {
  const res = db
    .prepare("UPDATE users SET credits = credits - ? WHERE id = ? AND credits >= ?")
    .run(amount, userId, amount);
  if (Number(res.changes) === 0) return false;
  db.prepare("INSERT INTO credit_events (id, user_id, delta, reason, created_at) VALUES (?, ?, ?, ?, ?)").run(
    `ce_${randomBytes(8).toString("base64url")}`,
    userId,
    -amount,
    reason,
    now()
  );
  return true;
}

export function hasClaimed(userId: string, reason: string): boolean {
  return !!db.prepare("SELECT 1 FROM credit_events WHERE user_id = ? AND reason = ?").get(userId, reason);
}

export type Plan = "free" | "pro" | "max";

export const PLANS: Plan[] = ["free", "pro", "max"];

/** One-time credit bonus granted when switching to a paid tier (demo, no real billing). */
export const PLAN_BONUS: Record<Plan, number> = { free: 0, pro: 100, max: 400 };

export function switchPlan(userId: string, plan: Plan): { ok: true; bonus: number } | { ok: false; error: string } {
  const row = db.prepare("SELECT plan FROM users WHERE id = ?").get(userId) as { plan: string } | undefined;
  if (!row) return { ok: false, error: "用户不存在" };
  if (row.plan === plan) return { ok: false, error: "已是当前套餐" };
  db.prepare("UPDATE users SET plan = ? WHERE id = ?").run(plan, userId);
  const reason = `plan:${plan}`;
  // Bonus is once per tier: downgrading and re-upgrading doesn't re-grant.
  if (PLAN_BONUS[plan] > 0 && !hasClaimed(userId, reason)) {
    recordEvent(userId, PLAN_BONUS[plan], reason);
    return { ok: true, bonus: PLAN_BONUS[plan] };
  }
  return { ok: true, bonus: 0 };
}

export function redeemCode(userId: string, rawCode: string): { ok: true; amount: number } | { ok: false; error: string } {
  const code = rawCode.trim().toUpperCase();
  const row = db.prepare("SELECT amount, used_by FROM redeem_codes WHERE code = ?").get(code) as
    | { amount: number; used_by: string | null }
    | undefined;
  if (!row) return { ok: false, error: "兑换码不存在" };
  if (row.used_by) return { ok: false, error: "该兑换码已被使用" };
  const res = db
    .prepare("UPDATE redeem_codes SET used_by = ?, used_at = ? WHERE code = ? AND used_by IS NULL")
    .run(userId, now(), code);
  if (Number(res.changes) === 0) return { ok: false, error: "该兑换码已被使用" };
  recordEvent(userId, row.amount, `redeem:${code}`);
  return { ok: true, amount: row.amount };
}

export function recentEvents(userId: string, limit = 20) {
  return db
    .prepare("SELECT delta, reason, created_at FROM credit_events WHERE user_id = ? ORDER BY created_at DESC LIMIT ?")
    .all(userId, limit)
    .map((r) => ({ ...r }));
}
