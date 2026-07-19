import { db, now } from "@/lib/db";
import { getUser, newId } from "@/lib/auth";
import { ownedProject } from "@/lib/projects";
import { runPipeline, type AgentEvent, type AppSpec } from "@/lib/agent";

export const dynamic = "force-dynamic";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getUser();
  if (!user) return Response.json({ error: "未登录" }, { status: 401 });
  const { id } = await ctx.params;
  const project = ownedProject(user.id, id);
  if (!project) return Response.json({ error: "项目不存在" }, { status: 404 });

  const { prompt } = await req.json().catch(() => ({}));
  if (typeof prompt !== "string" || !prompt.trim()) {
    return Response.json({ error: "请输入需求" }, { status: 400 });
  }
  const request = prompt.trim();

  const history = db
    .prepare("SELECT role, content FROM messages WHERE project_id = ? ORDER BY created_at")
    .all(id) as { role: "user" | "agent"; content: string }[];
  const currentVersion = project.current_version_id
    ? (db.prepare("SELECT html, spec FROM app_versions WHERE id = ?").get(project.current_version_id) as
        | { html: string; spec: string | null }
        | undefined)
    : undefined;

  db.prepare("INSERT INTO messages (id, project_id, role, content, created_at) VALUES (?, ?, 'user', ?, ?)").run(
    newId("m"),
    id,
    request,
    now()
  );

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: AgentEvent | { type: "version"; version: { id: string; num: number } }) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      };
      try {
        let spec: AppSpec | null = null;
        for await (const event of runPipeline({
          request,
          history,
          currentHtml: currentVersion?.html ?? null,
          specJson: currentVersion?.spec ?? null,
        })) {
          if (event.type === "plan") spec = event.spec;
          if (event.type === "html") {
            const versionId = newId("v");
            const num =
              ((db.prepare("SELECT MAX(num) AS m FROM app_versions WHERE project_id = ?").get(id) as { m: number | null })
                .m ?? 0) + 1;
            const specJson = spec ? JSON.stringify(spec) : (currentVersion?.spec ?? null);
            db.prepare(
              "INSERT INTO app_versions (id, project_id, num, html, spec, review_notes, prompt, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
            ).run(versionId, id, num, event.html, specJson, event.reviewNotes, request, now());
            db.prepare("UPDATE projects SET current_version_id = ?, updated_at = ?, name = COALESCE(?, name) WHERE id = ?").run(
              versionId,
              now(),
              spec?.name ?? null,
              id
            );
            send({ type: "version", version: { id: versionId, num } });
          } else if (event.type === "agent_message") {
            db.prepare(
              "INSERT INTO messages (id, project_id, role, content, created_at) VALUES (?, ?, 'agent', ?, ?)"
            ).run(newId("m"), id, event.content, now());
            send(event);
          } else {
            send(event);
          }
        }
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      } catch (err) {
        const message = err instanceof Error ? err.message : "生成失败";
        db.prepare(
          "INSERT INTO messages (id, project_id, role, content, meta, created_at) VALUES (?, ?, 'agent', ?, 'error', ?)"
        ).run(newId("m"), id, `生成失败:${message}`, now());
        send({ type: "error", message });
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      "x-accel-buffering": "no",
    },
  });
}
