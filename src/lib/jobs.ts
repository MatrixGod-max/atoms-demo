import { db, now } from "./db";
import { newId } from "./auth";
import { runPipeline, type AgentEvent, type AppSpec } from "./agent";
import { inlineImageAssets, loadPipelineAttachments } from "./attachments";
import type { GenerationMode } from "./models";

const MAX_CONCURRENT = 2;
const BUFFER_CAP = 9000;
const RETAIN_DONE_MS = 10 * 60_000;

export type JobStreamEvent =
  | AgentEvent
  | { type: "version"; version: { id: string; num: number } }
  | { type: "queued"; position: number }
  | { type: "job_state"; status: "queued" | "running" | "done" | "error"; error?: string };

export interface JobRow {
  id: string;
  project_id: string;
  user_id: string;
  prompt: string;
  status: "queued" | "running" | "done" | "error";
  stage: string | null;
  error: string | null;
}

interface LiveJob {
  id: string;
  projectId: string;
  userId: string;
  prompt: string;
  research: boolean;
  team: boolean;
  mode: GenerationMode;
  history: { role: "user" | "agent"; content: string }[];
  buffer: string[];
  droppedDeltas: boolean;
  done: boolean;
  listeners: Set<(payload: string) => void>;
}

class JobRunner {
  private live = new Map<string, LiveJob>();
  private queue: string[] = [];
  private running = 0;

  constructor() {
    // The process just started: nothing can still be running.
    db.prepare(
      "UPDATE jobs SET status='error', error='服务重启,任务中断', updated_at=? WHERE status IN ('queued','running')"
    ).run(now());
  }

  activeJobForProject(projectId: string): JobRow | undefined {
    return db
      .prepare("SELECT * FROM jobs WHERE project_id = ? AND status IN ('queued','running') ORDER BY created_at DESC")
      .get(projectId) as JobRow | undefined;
  }

  getJob(jobId: string): JobRow | undefined {
    return db.prepare("SELECT * FROM jobs WHERE id = ?").get(jobId) as JobRow | undefined;
  }

  getLive(jobId: string): LiveJob | undefined {
    return this.live.get(jobId);
  }

  start(
    projectId: string,
    userId: string,
    prompt: string,
    research = false,
    mode: GenerationMode = "fast",
    team = false
  ): { jobId: string; position: number } {
    const existing = this.activeJobForProject(projectId);
    if (existing) {
      const err = new Error("该项目已有生成任务在进行中") as Error & { code: number; jobId: string };
      err.code = 409;
      err.jobId = existing.id;
      throw err;
    }
    // Snapshot conversation context before recording the new user message.
    const history = db
      .prepare("SELECT role, content FROM messages WHERE project_id = ? ORDER BY created_at")
      .all(projectId)
      .map((r) => ({ ...r })) as { role: "user" | "agent"; content: string }[];

    const jobId = newId("j");
    const t = now();
    db.prepare(
      "INSERT INTO jobs (id, project_id, user_id, prompt, status, mode, team, created_at, updated_at) VALUES (?, ?, ?, ?, 'queued', ?, ?, ?, ?)"
    ).run(jobId, projectId, userId, prompt, mode, team ? 1 : 0, t, t);
    db.prepare("INSERT INTO messages (id, project_id, role, content, created_at) VALUES (?, ?, 'user', ?, ?)").run(
      newId("m"),
      projectId,
      prompt,
      t
    );

    const job: LiveJob = {
      id: jobId,
      projectId,
      userId,
      prompt,
      research,
      team,
      mode,
      history,
      buffer: [],
      droppedDeltas: false,
      done: false,
      listeners: new Set(),
    };
    this.live.set(jobId, job);
    this.queue.push(jobId);
    const position = this.queue.length + this.running - 1;
    if (position > 0) this.emit(job, { type: "queued", position });
    this.pump();
    return { jobId, position };
  }

  subscribe(jobId: string, cb: (payload: string) => void): { replay: string[]; done: boolean; detach: () => void } {
    const job = this.live.get(jobId);
    if (!job) return { replay: [], done: true, detach: () => {} };
    job.listeners.add(cb);
    return {
      replay: [...job.buffer],
      done: job.done,
      detach: () => job.listeners.delete(cb),
    };
  }

  private emit(job: LiveJob, event: JobStreamEvent) {
    const payload = JSON.stringify(event);
    if (job.buffer.length >= BUFFER_CAP) {
      // Never grow unbounded; shed the noisiest event type first.
      if (event.type === "code_delta") {
        job.droppedDeltas = true;
        return;
      }
      job.buffer.push(payload);
    } else {
      job.buffer.push(payload);
    }
    for (const l of job.listeners) l(payload);
  }

  private setStatus(jobId: string, status: JobRow["status"], patch: { stage?: string; error?: string } = {}) {
    db.prepare("UPDATE jobs SET status = ?, stage = COALESCE(?, stage), error = ?, updated_at = ? WHERE id = ?").run(
      status,
      patch.stage ?? null,
      patch.error ?? null,
      now(),
      jobId
    );
  }

  private pump() {
    while (this.running < MAX_CONCURRENT && this.queue.length > 0) {
      const jobId = this.queue.shift()!;
      const job = this.live.get(jobId);
      if (!job) continue;
      this.running++;
      this.run(job).finally(() => {
        this.running--;
        setTimeout(() => this.live.delete(job.id), RETAIN_DONE_MS);
        this.pump();
      });
    }
  }

  private async run(job: LiveJob) {
    this.setStatus(job.id, "running");
    this.emit(job, { type: "job_state", status: "running" });
    try {
      const project = db.prepare("SELECT current_version_id, platform, theme FROM projects WHERE id = ?").get(job.projectId) as
        | { current_version_id: string | null; platform: "web" | "mobile"; theme: string | null }
        | undefined;
      if (!project) throw new Error("项目已被删除");
      const currentVersion = project.current_version_id
        ? (db.prepare("SELECT html, spec FROM app_versions WHERE id = ?").get(project.current_version_id) as
            | { html: string; spec: string | null }
            | undefined)
        : undefined;

      const attachments = loadPipelineAttachments(job.projectId);
      let spec: AppSpec | null = null;
      for await (const event of runPipeline({
        request: job.prompt,
        history: job.history,
        currentHtml: currentVersion?.html ?? null,
        specJson: currentVersion?.spec ?? null,
        platform: project.platform === "mobile" ? "mobile" : "web",
        research: job.research,
        team: job.team,
        theme: project.theme,
        attachments,
        mode: job.mode,
      })) {
        if (event.type === "plan") spec = event.spec;
        if (event.type === "stage" && event.status === "start") {
          this.setStatus(job.id, "running", { stage: event.stage });
        }
        if (event.type === "pm" || event.type === "architect") {
          if (event.type === "pm") {
            spec = { name: event.stories.name, summary: event.stories.summary, features: event.stories.stories.slice(0, 5), design: "" };
          }
          db.prepare(
            "INSERT INTO messages (id, project_id, role, content, meta, created_at) VALUES (?, ?, 'agent', ?, ?, ?)"
          ).run(newId("m"), job.projectId, JSON.stringify(event.type === "pm" ? event.stories : event.blueprint), event.type, now());
          this.emit(job, event);
          continue;
        }
        if (event.type === "research") {
          db.prepare(
            "INSERT INTO messages (id, project_id, role, content, meta, created_at) VALUES (?, ?, 'agent', ?, 'research', ?)"
          ).run(newId("m"), job.projectId, JSON.stringify(event.brief), now());
          this.emit(job, event);
          continue;
        }
        if (event.type === "html") {
          const finalHtml = inlineImageAssets(event.html, attachments);
          const versionId = newId("v");
          const num =
            ((db.prepare("SELECT MAX(num) AS m FROM app_versions WHERE project_id = ?").get(job.projectId) as {
              m: number | null;
            }).m ?? 0) + 1;
          const specJson = spec ? JSON.stringify(spec) : (currentVersion?.spec ?? null);
          db.prepare(
            "INSERT INTO app_versions (id, project_id, num, html, spec, review_notes, prompt, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
          ).run(versionId, job.projectId, num, finalHtml, specJson, event.reviewNotes, job.prompt, now());
          db.prepare(
            "UPDATE projects SET current_version_id = ?, updated_at = ?, name = COALESCE(?, name) WHERE id = ?"
          ).run(versionId, now(), spec?.name ?? null, job.projectId);
          this.emit(job, { type: "version", version: { id: versionId, num } });
        } else if (event.type === "agent_message") {
          db.prepare("INSERT INTO messages (id, project_id, role, content, created_at) VALUES (?, ?, 'agent', ?, ?)").run(
            newId("m"),
            job.projectId,
            event.content,
            now()
          );
          this.emit(job, event);
        } else {
          this.emit(job, event);
        }
      }
      this.setStatus(job.id, "done");
      this.emit(job, { type: "job_state", status: "done" });
    } catch (err) {
      const message = err instanceof Error ? err.message : "生成失败";
      db.prepare(
        "INSERT INTO messages (id, project_id, role, content, meta, created_at) VALUES (?, ?, 'agent', ?, 'error', ?)"
      ).run(newId("m"), job.projectId, `生成失败:${message}`, now());
      this.setStatus(job.id, "error", { error: message });
      this.emit(job, { type: "error", message });
      this.emit(job, { type: "job_state", status: "error", error: message });
    } finally {
      job.done = true;
    }
  }
}

const g = globalThis as unknown as { __quarkJobs?: JobRunner };
export const jobRunner: JobRunner = g.__quarkJobs ?? (g.__quarkJobs = new JobRunner());
