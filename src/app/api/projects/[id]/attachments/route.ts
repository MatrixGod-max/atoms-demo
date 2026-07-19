import { NextResponse } from "next/server";
import { db, now } from "@/lib/db";
import { demoGuard, getUser, newId } from "@/lib/auth";
import { ownedProject } from "@/lib/projects";
import { attachmentKind, listAttachments, validateAttachment } from "@/lib/attachments";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const blocked = demoGuard(user);
  if (blocked) return NextResponse.json({ error: blocked }, { status: 403 });
  const { id } = await ctx.params;
  if (!ownedProject(user.id, id)) return NextResponse.json({ error: "项目不存在" }, { status: 404 });

  const { filename, mime, dataBase64 } = await req.json().catch(() => ({}));
  if (typeof filename !== "string" || typeof mime !== "string" || typeof dataBase64 !== "string") {
    return NextResponse.json({ error: "参数不完整" }, { status: 400 });
  }
  let data: Buffer;
  try {
    data = Buffer.from(dataBase64, "base64");
  } catch {
    return NextResponse.json({ error: "文件编码无效" }, { status: 400 });
  }
  const count = (db.prepare("SELECT COUNT(*) AS c FROM attachments WHERE project_id = ?").get(id) as { c: number }).c;
  const invalid = validateAttachment(mime, data.length, count);
  if (invalid) return NextResponse.json({ error: invalid }, { status: 400 });

  const attId = newId("att");
  db.prepare(
    "INSERT INTO attachments (id, project_id, user_id, filename, mime, kind, size, data, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
  ).run(attId, id, user.id, filename.slice(0, 80), mime, attachmentKind(mime)!, data.length, data, now());
  return NextResponse.json({ ok: true, attachments: listAttachments(id) });
}
