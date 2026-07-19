import { NextResponse } from "next/server";
import { db, now } from "@/lib/db";
import { getUser, newId } from "@/lib/auth";

export async function GET() {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const projects = db
    .prepare(
      `SELECT p.id, p.name, p.slug, p.updated_at, p.created_at,
              (SELECT COUNT(*) FROM app_versions v WHERE v.project_id = p.id) AS version_count
       FROM projects p WHERE p.user_id = ? ORDER BY p.updated_at DESC`
    )
    .all(user.id);
  return NextResponse.json({ projects });
}

export async function POST(req: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const { prompt } = await req.json().catch(() => ({}));
  if (typeof prompt !== "string" || !prompt.trim()) {
    return NextResponse.json({ error: "请描述你想要的应用" }, { status: 400 });
  }
  const id = newId("p");
  const t = now();
  db.prepare(
    "INSERT INTO projects (id, user_id, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?)"
  ).run(id, user.id, prompt.trim().slice(0, 30), t, t);
  return NextResponse.json({ id, prompt: prompt.trim() });
}
