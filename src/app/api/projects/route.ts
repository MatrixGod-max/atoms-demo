import { NextResponse } from "next/server";
import { db, now } from "@/lib/db";
import { demoGuard, getUser, newId } from "@/lib/auth";

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
  const blocked = demoGuard(user);
  if (blocked) return NextResponse.json({ error: blocked }, { status: 403 });
  const { prompt, remixSlug, templateId, platform, theme, connectors } = await req.json().catch(() => ({}));
  const chosenConnectors = Array.isArray(connectors) && connectors.length ? JSON.stringify(connectors.slice(0, 5)) : null;
  const chosenTheme = typeof theme === "string" && theme.trim() ? theme.trim().slice(0, 20) : null;
  const chosenPlatform = platform === "mobile" ? "mobile" : "web";

  // Start from a curated template (v1 = the template HTML).
  if (typeof templateId === "string" && templateId) {
    const tpl = db.prepare("SELECT id, name, platform, html FROM templates WHERE id = ?").get(templateId) as
      | { id: string; name: string; platform: string; html: string }
      | undefined;
    if (!tpl) return NextResponse.json({ error: "模板不存在" }, { status: 404 });
    const id = newId("p");
    const versionId = newId("v");
    const t = now();
    db.prepare(
      "INSERT INTO projects (id, user_id, name, platform, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)"
    ).run(id, user.id, tpl.name.slice(0, 40), tpl.platform, t, t);
    db.prepare(
      "INSERT INTO app_versions (id, project_id, num, html, review_notes, prompt, created_at) VALUES (?, ?, 1, ?, ?, ?, ?)"
    ).run(versionId, id, tpl.html, `模板「${tpl.name}」`, `模板快速开始:${tpl.name}`, t);
    db.prepare("UPDATE projects SET current_version_id = ? WHERE id = ?").run(versionId, id);
    db.prepare("INSERT INTO messages (id, project_id, role, content, created_at) VALUES (?, ?, 'agent', ?, ?)").run(
      newId("m"),
      id,
      `已用模板「${tpl.name}」创建项目,v1 即模板本身。直接提需求(比如改文案、换品牌色、加板块),我会在模板基础上修改。`,
      t
    );
    return NextResponse.json({ id, fromTemplate: true });
  }

  // Fork a published app into a new project of your own (v1 = its published HTML).
  if (typeof remixSlug === "string" && remixSlug) {
    const source = db
      .prepare(
        `SELECT p.name, p.platform, v.html, v.spec FROM projects p JOIN app_versions v ON v.id = p.published_version_id
         WHERE p.slug = ? AND p.published_version_id IS NOT NULL`
      )
      .get(remixSlug) as { name: string; platform: string; html: string; spec: string | null } | undefined;
    if (!source) return NextResponse.json({ error: "源应用不存在或未发布" }, { status: 404 });
    const id = newId("p");
    const versionId = newId("v");
    const t = now();
    db.prepare(
      "INSERT INTO projects (id, user_id, name, platform, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)"
    ).run(id, user.id, `Remix · ${source.name}`.slice(0, 40), source.platform, t, t);
    db.prepare(
      "INSERT INTO app_versions (id, project_id, num, html, spec, review_notes, prompt, created_at) VALUES (?, ?, 1, ?, ?, ?, ?, ?)"
    ).run(versionId, id, source.html, source.spec, `Remix 自 /${remixSlug}`, `Remix 自 ${source.name}`, t);
    db.prepare("UPDATE projects SET current_version_id = ? WHERE id = ?").run(versionId, id);
    db.prepare("INSERT INTO messages (id, project_id, role, content, created_at) VALUES (?, ?, 'agent', ?, ?)").run(
      newId("m"),
      id,
      `已从「${source.name}」Remix 出这个项目,当前 v1 与源应用一致。直接提需求,我会在它的基础上修改。`,
      t
    );
    return NextResponse.json({ id, remixed: true });
  }

  if (typeof prompt !== "string" || !prompt.trim()) {
    return NextResponse.json({ error: "请描述你想要的应用" }, { status: 400 });
  }
  const id = newId("p");
  const t = now();
  db.prepare(
    "INSERT INTO projects (id, user_id, name, platform, theme, connectors, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
  ).run(id, user.id, prompt.trim().slice(0, 30), chosenPlatform, chosenTheme, chosenConnectors, t, t);
  return NextResponse.json({ id, prompt: prompt.trim() });
}
