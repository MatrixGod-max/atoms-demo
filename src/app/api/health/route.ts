import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const users = (db.prepare("SELECT COUNT(*) AS c FROM users").get() as { c: number }).c;
    const activeJobs = (
      db.prepare("SELECT COUNT(*) AS c FROM jobs WHERE status IN ('queued','running')").get() as { c: number }
    ).c;
    return NextResponse.json({ ok: true, users, activeJobs, uptimeSec: Math.floor(process.uptime()) });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "db error" }, { status: 503 });
  }
}
