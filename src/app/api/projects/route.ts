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
  const { prompt, remixSlug, templateId, platform, theme, connectors, goal, fuseSlugs, engine } = await req.json().catch(() => ({}));
  // Absent engine stays "single" so older clients/flows keep their behavior; the UI sends it explicitly.
  const chosenEngine = engine === "project" ? "project" : "single";
  const chosenConnectors = Array.isArray(connectors) && connectors.length ? JSON.stringify(connectors.slice(0, 5)) : null;
  const chosenTheme = typeof theme === "string" && theme.trim() ? theme.trim().slice(0, 20) : null;
  const chosenPlatform = platform === "mobile" ? "mobile" : "web";
  const chosenGoal = typeof goal === "string" && goal.trim() ? goal.trim().slice(0, 500) : null;

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

  // 聚变: merge two published apps into one brand-new project. No v1 here —
  // the first generation runs the Fusion Analyst + Engineer over both sources.
  if (Array.isArray(fuseSlugs)) {
    const slugs = fuseSlugs.filter((s: unknown): s is string => typeof s === "string" && !!s);
    if (slugs.length !== 2 || slugs[0] === slugs[1]) {
      return NextResponse.json({ error: "聚变需要选择两个不同的已发布应用" }, { status: 400 });
    }
    const pick = db.prepare(
      `SELECT p.slug, p.name, p.platform, p.engine FROM projects p
       WHERE p.slug = ? AND p.published_version_id IS NOT NULL`
    );
    const sources = slugs.map((s: string) => pick.get(s) as { slug: string; name: string; platform: string; engine: string } | undefined);
    if (sources.some((s) => !s)) return NextResponse.json({ error: "源应用不存在或未发布" }, { status: 404 });
    const [a, b] = sources as { slug: string; name: string; platform: string; engine: string }[];
    const id = newId("p");
    const t = now();
    // Either source being a project engine lifts the fusion result to project engine.
    const fusedEngine = a.engine === "project" || b.engine === "project" ? "project" : "single";
    db.prepare(
      "INSERT INTO projects (id, user_id, name, platform, engine, fused_from, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
    ).run(id, user.id, `聚变 · ${a.name} × ${b.name}`.slice(0, 40), a.platform, fusedEngine, JSON.stringify([{ slug: a.slug, name: a.name }, { slug: b.slug, name: b.name }]), t, t);
    db.prepare("INSERT INTO messages (id, project_id, role, content, created_at) VALUES (?, ?, 'agent', ?, ?)").run(
      newId("m"),
      id,
      `⚛ 已创建聚变项目:「${a.name}」×「${b.name}」。首次生成将由聚变分析师拆解两者能力并合并为一个全新应用(消耗额外 2 积分)。`,
      t
    );
    return NextResponse.json({ id, fused: true, sources: [a.name, b.name] });
  }

  // Fork a published app into a new project of your own (v1 = its published HTML).
  if (typeof remixSlug === "string" && remixSlug) {
    const source = db
      .prepare(
        `SELECT p.name, p.platform, p.engine, v.html, v.spec, v.files FROM projects p JOIN app_versions v ON v.id = p.published_version_id
         WHERE p.slug = ? AND p.published_version_id IS NOT NULL`
      )
      .get(remixSlug) as
      | { name: string; platform: string; engine: string; html: string; spec: string | null; files: string | null }
      | undefined;
    if (!source) return NextResponse.json({ error: "源应用不存在或未发布" }, { status: 404 });
    const id = newId("p");
    const versionId = newId("v");
    const t = now();
    db.prepare(
      "INSERT INTO projects (id, user_id, name, platform, engine, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
    ).run(id, user.id, `Remix · ${source.name}`.slice(0, 40), source.platform, source.engine, t, t);
    db.prepare(
      "INSERT INTO app_versions (id, project_id, num, html, spec, review_notes, prompt, files, created_at) VALUES (?, ?, 1, ?, ?, ?, ?, ?, ?)"
    ).run(versionId, id, source.html, source.spec, `Remix 自 /${remixSlug}`, `Remix 自 ${source.name}`, source.files, t);
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
    "INSERT INTO projects (id, user_id, name, platform, engine, theme, connectors, goal, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
  ).run(id, user.id, prompt.trim().slice(0, 30), chosenPlatform, chosenEngine, chosenTheme, chosenConnectors, chosenGoal, t, t);
  return NextResponse.json({ id, prompt: prompt.trim() });
}
