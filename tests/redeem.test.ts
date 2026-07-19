import { describe, expect, it } from "vitest";
import { randomBytes } from "node:crypto";
import { db, now } from "@/lib/db";
import { PLAN_BONUS, balance, redeemCode, switchPlan } from "@/lib/credits";

function makeUser(): string {
  const id = `u_test_${randomBytes(6).toString("base64url")}`;
  db.prepare("INSERT INTO users (id, email, name, password_hash, created_at) VALUES (?, ?, ?, ?, ?)").run(
    id,
    `${id}@test.local`,
    "测试用户",
    "salt:hash",
    now()
  );
  return id;
}

function makeCode(amount: number): string {
  const code = `TEST-${randomBytes(4).toString("hex").toUpperCase()}`;
  db.prepare("INSERT INTO redeem_codes (code, amount, created_at) VALUES (?, ?, ?)").run(code, amount, now());
  return code;
}

describe("redeemCode", () => {
  it("credits the ledger on success and normalizes input", () => {
    const user = makeUser();
    const code = makeCode(50);
    const res = redeemCode(user, `  ${code.toLowerCase()}  `);
    expect(res).toEqual({ ok: true, amount: 50 });
    expect(balance(user)).toBe(50);
    const event = db
      .prepare("SELECT reason FROM credit_events WHERE user_id = ?")
      .get(user) as { reason: string };
    expect(event.reason).toBe(`redeem:${code}`);
  });

  it("rejects an already-used code", () => {
    const user = makeUser();
    const other = makeUser();
    const code = makeCode(10);
    expect(redeemCode(user, code).ok).toBe(true);
    expect(redeemCode(other, code)).toEqual({ ok: false, error: "该兑换码已被使用" });
    expect(balance(other)).toBe(0);
  });

  it("rejects an unknown code", () => {
    const user = makeUser();
    expect(redeemCode(user, "FUSION-NOPE-NOPE")).toEqual({ ok: false, error: "兑换码不存在" });
  });
});

describe("switchPlan", () => {
  it("grants the tier bonus once, even after downgrade and re-upgrade", () => {
    const user = makeUser();
    const up = switchPlan(user, "pro");
    expect(up).toEqual({ ok: true, bonus: PLAN_BONUS.pro });
    expect(balance(user)).toBe(PLAN_BONUS.pro);

    expect(switchPlan(user, "free")).toEqual({ ok: true, bonus: 0 });
    expect(switchPlan(user, "pro")).toEqual({ ok: true, bonus: 0 });
    expect(balance(user)).toBe(PLAN_BONUS.pro);
  });

  it("rejects switching to the current plan", () => {
    const user = makeUser();
    expect(switchPlan(user, "free")).toEqual({ ok: false, error: "已是当前套餐" });
  });

  it("persists the plan on the user row", () => {
    const user = makeUser();
    switchPlan(user, "max");
    const row = db.prepare("SELECT plan FROM users WHERE id = ?").get(user) as { plan: string };
    expect(row.plan).toBe("max");
  });
});
