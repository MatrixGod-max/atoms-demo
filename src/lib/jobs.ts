import { db, now } from "./db";
import { newId } from "./auth";
import { runPipeline, runGoalEval, type AgentEvent, type AppSpec, type GoalEvalResult } from "./agent";
import { inlineImageAssets, loadPipelineAttachments } from "./attachments";
import type { GenerationMode } from "./models";
import { charge, generationCost, recordEvent } from "./credits";
import { parseConnectors } from "./connectors";

const MAX_CONCURRENT = 2;
const BUFFER_CAP = 9000;
const RETAIN_DONE_MS = 10 * 60_000;
const DAILY_QUOTA = Number(process.env.DAILY_GENERATION_QUOTA || 30);

export type JobStreamEvent =
  | AgentEvent
  | { type: "version"; version: { id: string; num: number } }
  | { type: "queued"; position: number }
  | { type: "job_state"; status: "queued" | "running" | "done" | "error"; error?: string }
  | { type: "goal_eval"; result: GoalEvalResult; round: number; maxRounds: number }
  | { type: "goal_next"; jobId: string; round: number; prompt: string };

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
  cost: number;
  target: { selector: string; snippet: string } | null;
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
    // The process just started: nothing can still be running. Only the real
    // server runtime may claim this — vitest collector forks and next-build
    // workers import this module too and must not stomp a live process's DB.
    if (!process.env.VITEST && process.env.NEXT_PHASE !== "phase-production-build") {
      db.prepare(
        "UPDATE jobs SET status='error', error='服务重启,任务中断', updated_at=? WHERE status IN ('queued','running')"
      ).run(now());
      db.prepare("UPDATE projects SET goal_active = 0, goal_status = 'stopped' WHERE goal_active = 1").run();
    }
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
    team = false,
    cost = 0,
    target: { selector: string; snippet: string } | null = null,
    auto = false
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
    db.prepare("INSERT INTO messages (id, project_id, role, content, meta, created_at) VALUES (?, ?, 'user', ?, ?, ?)").run(
      newId("m"),
      projectId,
      prompt,
      auto ? "goal_auto" : null,
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
      cost,
      target,
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
      const project = db.prepare("SELECT current_version_id, platform, theme, connectors, goal, acceptance, fused_from FROM projects WHERE id = ?").get(job.projectId) as
        | { current_version_id: string | null; platform: "web" | "mobile"; theme: string | null; connectors: string | null; goal: string | null; acceptance: string | null; fused_from: string | null }
        | undefined;
      if (!project) throw new Error("项目已被删除");
      const currentVersion = project.current_version_id
        ? (db.prepare("SELECT html, spec FROM app_versions WHERE id = ?").get(project.current_version_id) as
            | { html: string; spec: string | null }
            | undefined)
        : undefined;

      const attachments = loadPipelineAttachments(job.projectId);
      let acceptance: string[] | null = null;
      try {
        acceptance = project.acceptance ? (JSON.parse(project.acceptance) as string[]) : null;
      } catch {
        acceptance = null;
      }
      // 聚变 first generation: load both published sources for the Fusion Analyst.
      let fusionSources: { name: string; html: string; spec: string | null }[] | null = null;
      if (project.fused_from && !project.current_version_id) {
        try {
          const from = JSON.parse(project.fused_from) as { slug: string; name: string }[];
          const rows = from
            .map(
              (f) =>
                db
                  .prepare(
                    `SELECT p.name, v.html, v.spec FROM projects p JOIN app_versions v ON v.id = p.published_version_id
                     WHERE p.slug = ? AND p.published_version_id IS NOT NULL`
                  )
                  .get(f.slug) as { name: string; html: string; spec: string | null } | undefined
            )
            .filter((r): r is { name: string; html: string; spec: string | null } => !!r);
          if (rows.length === 2) fusionSources = rows;
        } catch {
          fusionSources = null;
        }
      }
      let spec: AppSpec | null = null;
      let producedHtml: string | null = null;
      for await (const event of runPipeline({
        request: job.prompt,
        history: job.history,
        currentHtml: currentVersion?.html ?? null,
        specJson: currentVersion?.spec ?? null,
        platform: project.platform === "mobile" ? "mobile" : "web",
        research: job.research,
        team: job.team,
        theme: project.theme,
        connectors: parseConnectors(project.connectors),
        attachments,
        mode: job.mode,
        target: job.target,
        goal: project.goal,
        acceptance,
        fusionSources,
      })) {
        if (event.type === "plan") spec = event.spec;
        if (event.type === "stage" && event.status === "start") {
          this.setStatus(job.id, "running", { stage: event.stage });
        }
        if (event.type === "pm" || event.type === "architect") {
          if (event.type === "pm") {
            spec = { name: event.stories.name, summary: event.stories.summary, features: event.stories.stories.slice(0, 5), design: "" };
            if (Array.isArray(event.stories.acceptance) && event.stories.acceptance.length) {
              // Persist PM acceptance criteria: later iterations re-verify against them.
              db.prepare("UPDATE projects SET acceptance = ? WHERE id = ?").run(
                JSON.stringify(event.stories.acceptance.slice(0, 6)),
                job.projectId
              );
            }
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
        if (event.type === "fusion") {
          spec = {
            name: event.plan.name,
            summary: event.plan.summary,
            features: [...event.plan.from_a, ...event.plan.from_b].slice(0, 5),
            design: "",
          };
          db.prepare(
            "INSERT INTO messages (id, project_id, role, content, meta, created_at) VALUES (?, ?, 'agent', ?, 'fusion', ?)"
          ).run(newId("m"), job.projectId, JSON.stringify(event.plan), now());
          this.emit(job, event);
          continue;
        }
        if (event.type === "acceptance") {
          db.prepare(
            "INSERT INTO messages (id, project_id, role, content, meta, created_at) VALUES (?, ?, 'agent', ?, 'acceptance', ?)"
          ).run(newId("m"), job.projectId, JSON.stringify(event.results), now());
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
          producedHtml = finalHtml;
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
      // Goal mode: evaluate this round and possibly chain the next one.
      const next = await this.evaluateGoal(job, producedHtml);
      this.setStatus(job.id, "done");
      if (next) {
        try {
          const started = this.start(job.projectId, job.userId, next.prompt, job.research, job.mode, job.team, next.cost, null, true);
          this.emit(job, { type: "goal_next", jobId: started.jobId, round: next.round, prompt: next.prompt });
        } catch {
          recordEvent(job.userId, next.cost, "refund:failed-job");
          this.endGoal(job, "error", "🎯 下一轮启动失败,自动迭代结束");
        }
      }
      this.emit(job, { type: "job_state", status: "done" });
    } catch (err) {
      const message = err instanceof Error ? err.message : "生成失败";
      db.prepare(
        "INSERT INTO messages (id, project_id, role, content, meta, created_at) VALUES (?, ?, 'agent', ?, 'error', ?)"
      ).run(newId("m"), job.projectId, `生成失败:${message}`, now());
      this.setStatus(job.id, "error", { error: message });
      if (job.cost > 0) recordEvent(job.userId, job.cost, "refund:failed-job");
      const g = db.prepare("SELECT goal_active FROM projects WHERE id = ?").get(job.projectId) as
        | { goal_active: number }
        | undefined;
      if (g?.goal_active) this.endGoal(job, "error", "🎯 本轮生成失败,自动迭代结束");
      this.emit(job, { type: "error", message });
      this.emit(job, { type: "job_state", status: "error", error: message });
    } finally {
      job.done = true;
    }
  }

  /**
   * Goal-mode round boundary: judge the freshly produced version against the goal,
   * then decide to finish or charge & chain the next auto round. Returns the next
   * round to start, or null when the loop ends (or no goal loop is active).
   */
  private async evaluateGoal(job: LiveJob, html: string | null): Promise<{ prompt: string; cost: number; round: number } | null> {
    const project = db
      .prepare("SELECT goal, goal_active, goal_round, goal_rounds, goal_status FROM projects WHERE id = ?")
      .get(job.projectId) as
      | { goal: string | null; goal_active: number; goal_round: number; goal_rounds: number; goal_status: string | null }
      | undefined;
    if (!project?.goal || !html) return null;
    if (!project.goal_active) {
      // Externally stopped between rounds (or never armed): confirm once, never overwrite a settled status.
      if (project.goal_status === "running") this.endGoal(job, "stopped", "⏹ 已按你的要求停止自动迭代");
      return null;
    }

    const round = project.goal_round + 1;
    db.prepare("UPDATE projects SET goal_round = ? WHERE id = ?").run(round, job.projectId);
    let result: GoalEvalResult;
    try {
      result = await runGoalEval({ goal: project.goal, html, round, maxRounds: project.goal_rounds, mode: job.mode });
    } catch {
      this.endGoal(job, "error", "🎯 目标评估失败,自动迭代结束");
      return null;
    }
    db.prepare(
      "INSERT INTO messages (id, project_id, role, content, meta, created_at) VALUES (?, ?, 'agent', ?, 'goal_eval', ?)"
    ).run(newId("m"), job.projectId, JSON.stringify({ ...result, round, maxRounds: project.goal_rounds }), now());
    this.emit(job, { type: "goal_eval", result, round, maxRounds: project.goal_rounds });

    // The user may have hit stop while the evaluator was running.
    const fresh = db.prepare("SELECT goal_active FROM projects WHERE id = ?").get(job.projectId) as { goal_active: number };
    if (!fresh.goal_active) return null;

    if (result.met) {
      this.endGoal(job, "met", `🎯 目标已达成(第 ${round} 轮,评分 ${result.score})`);
      return null;
    }
    if (round >= project.goal_rounds) {
      this.endGoal(job, "cap", `🎯 已达轮次上限(${project.goal_rounds} 轮),自动迭代结束`);
      return null;
    }
    const dayCount = (
      db.prepare("SELECT COUNT(*) AS c FROM jobs WHERE user_id = ? AND created_at > ?").get(job.userId, now() - 86_400_000) as { c: number }
    ).c;
    if (dayCount >= DAILY_QUOTA) {
      this.endGoal(job, "cap", "🎯 已达今日生成次数上限,自动迭代结束");
      return null;
    }
    const cost = generationCost(job.mode, job.research, job.team);
    if (!charge(job.userId, cost, `goal-round:${round + 1}`)) {
      this.endGoal(job, "no_credits", `🎯 积分不足(下一轮需 ${cost}),自动迭代结束`);
      return null;
    }
    const prompt = result.next_request?.trim() || `继续向目标推进:${project.goal}`;
    return { prompt, cost, round: round + 1 };
  }

  private endGoal(job: LiveJob, status: string, text: string) {
    db.prepare("UPDATE projects SET goal_active = 0, goal_status = ? WHERE id = ?").run(status, job.projectId);
    db.prepare("INSERT INTO messages (id, project_id, role, content, created_at) VALUES (?, ?, 'agent', ?, ?)").run(
      newId("m"),
      job.projectId,
      text,
      now()
    );
    this.emit(job, { type: "agent_message", content: text });
  }
}

const g = globalThis as unknown as { __quarkJobs?: JobRunner };
export const jobRunner: JobRunner = g.__quarkJobs ?? (g.__quarkJobs = new JobRunner());
