import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const templates = db
    .prepare("SELECT id, name, category, platform, description FROM templates ORDER BY created_at")
    .all()
    .map((r) => ({ ...r }));
  return NextResponse.json({ templates });
}
