import { describe, expect, it } from "vitest";
import { db, now } from "@/lib/db";
import { newId } from "@/lib/auth";

describe("username auth schema", () => {
  it("keeps legacy email users intact after the relax migration", () => {
    const email = db.prepare("PRAGMA table_info(users)").all() as { name: string; notnull: number }[];
    expect(email.find((c) => c.name === "email")?.notnull).toBe(0);
    expect(email.some((c) => c.name === "username")).toBe(true);
  });

  it("allows users without an email (username only)", () => {
    const a = newId("u");
    const b = newId("u");
    const ins = db.prepare(
      "INSERT INTO users (id, email, username, name, password_hash, created_at) VALUES (?, NULL, ?, 't', 'x', ?)"
    );
    ins.run(a, `user_${a}`, now());
    ins.run(b, `user_${b}`, now());
    const row = db.prepare("SELECT email, username FROM users WHERE id = ?").get(a) as {
      email: string | null;
      username: string;
    };
    expect(row.email).toBeNull();
    expect(row.username).toBe(`user_${a}`);
  });

  it("enforces case-insensitive username uniqueness", () => {
    const a = newId("u");
    const ins = db.prepare(
      "INSERT INTO users (id, email, username, name, password_hash, created_at) VALUES (?, NULL, ?, 't', 'x', ?)"
    );
    ins.run(a, `Case_${a}`, now());
    expect(() => ins.run(newId("u"), `case_${a}`, now())).toThrow();
  });
});
