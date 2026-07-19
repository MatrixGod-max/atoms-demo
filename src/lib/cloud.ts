/**
 * Fusion Cloud:把 214 模拟成云主机 —— 云端真实构建(vite)+ 常驻静态托管 + 实例生命周期。
 * 计费:部署 CLOUD_DEPLOY_COST 一次性 + running 状态按 CLOUD_HOURLY_RATE 每小时结算
 * (settleCloudBilling,余额不足自动停机)。CLOUD_MOCK=1 全链路桩(测试/CI/smoke)。
 * 模式对齐 nativeBuild.ts:进程内单并发、tar|ssh 流式上传、失败退款、日志尾入库。
 */
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { db, now } from "./db";
import { newId } from "./auth";
import { charge, recordEvent } from "./credits";
import { parseStoredFiles } from "./projectFiles";
import { exportAppHtml } from "./serveApp";

const HOST = process.env.NATIVE_BUILD_HOST || "ubuntu@10.234.201.214";
const MOCK = process.env.CLOUD_MOCK === "1";
const BUILD_TIMEOUT_MS = 8 * 60_000;
const LOG_CAP = 8_000;

export const CLOUD_DEPLOY_COST = 2;
export const CLOUD_HOURLY_RATE = 1;

export interface CloudInstanceRow {
  id: string;
  project_id: string;
  user_id: string;
  slug: string;
  status: "deploying" | "running" | "stopped" | "error";
  artifact_seq: number | null;
  hourly_rate: number;
  log: string | null;
  error: string | null;
  deployed_at: number | null;
  last_billed_at: number | null;
  created_at: number;
  updated_at: number;
}

function runShell(cmd: string, timeoutMs: number): Promise<{ code: number; output: string }> {
  return new Promise((resolve) => {
    const child = spawn("bash", ["-c", cmd], { stdio: ["ignore", "pipe", "pipe"] });
    let output = "";
    const cap = (chunk: Buffer) => {
      output = (output + chunk.toString()).slice(-LOG_CAP * 2);
    };
    child.stdout.on("data", cap);
    child.stderr.on("data", cap);
    const timer = setTimeout(() => {
      output += "\n[超时,已终止]";
      child.kill("SIGKILL");
    }, timeoutMs);
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ code: code ?? 1, output });
    });
  });
}

const q = (s: string) => `'${s.replace(/'/g, "")}'`;

class CloudRunner {
  private busy = false;

  get(projectId: string): CloudInstanceRow | undefined {
    return db.prepare("SELECT * FROM cloud_instances WHERE project_id = ?").get(projectId) as
      | CloudInstanceRow
      | undefined;
  }

  listRunning(userId?: string): CloudInstanceRow[] {
    const rows = userId
      ? db.prepare("SELECT * FROM cloud_instances WHERE status = 'running' AND user_id = ?").all(userId)
      : db.prepare("SELECT * FROM cloud_instances WHERE status = 'running'").all();
    return rows as unknown as CloudInstanceRow[];
  }

  private patch(id: string, fields: Partial<CloudInstanceRow>) {
    const cur = db.prepare("SELECT * FROM cloud_instances WHERE id = ?").get(id) as unknown as CloudInstanceRow;
    const has = (k: string) => Object.prototype.hasOwnProperty.call(fields, k);
    db.prepare(
      "UPDATE cloud_instances SET status = ?, artifact_seq = ?, log = ?, error = ?, deployed_at = ?, last_billed_at = ?, updated_at = ? WHERE id = ?"
    ).run(
      fields.status ?? cur.status,
      fields.artifact_seq ?? cur.artifact_seq,
      fields.log ?? cur.log,
      has("error") ? (fields.error as string | null) : cur.error,
      fields.deployed_at ?? cur.deployed_at,
      has("last_billed_at") ? (fields.last_billed_at as number | null) : cur.last_billed_at,
      now(),
      id
    );
  }

  /** 部署(或重新部署)。前置:项目已发布(有 slug 与制品);cost 已由调用方扣除,失败在此退款。 */
  async deploy(projectId: string, userId: string, cost: number): Promise<CloudInstanceRow> {
    if (this.busy) {
      const err = new Error("云构建通道忙,请稍后再试") as Error & { code: number };
      err.code = 409;
      throw err;
    }
    const project = db
      .prepare("SELECT slug, published_version_id, current_version_id, connectors, platform FROM projects WHERE id = ?")
      .get(projectId) as
      | { slug: string | null; published_version_id: string | null; current_version_id: string | null; connectors: string | null; platform: "web" | "mobile" }
      | undefined;
    if (!project?.slug || !project.published_version_id) {
      const err = new Error("请先发布应用,再部署到 Fusion Cloud") as Error & { code: number };
      err.code = 400;
      throw err;
    }
    const seqRow = db
      .prepare("SELECT MAX(seq) AS m FROM artifacts WHERE project_id = ?")
      .get(projectId) as { m: number | null };
    const version = db
      .prepare("SELECT html, files FROM app_versions WHERE id = ?")
      .get(project.published_version_id) as { html: string; files: string | null };

    let inst = this.get(projectId);
    const t = now();
    if (!inst) {
      db.prepare(
        "INSERT INTO cloud_instances (id, project_id, user_id, slug, status, hourly_rate, created_at, updated_at) VALUES (?, ?, ?, ?, 'deploying', ?, ?, ?)"
      ).run(newId("ci"), projectId, userId, project.slug, CLOUD_HOURLY_RATE, t, t);
      inst = this.get(projectId)!;
    } else {
      this.patch(inst.id, { status: "deploying", error: null });
    }

    this.busy = true;
    try {
      if (MOCK) {
        await new Promise((r) => setTimeout(r, 300));
        if (project.slug.includes("mockcloudfail")) throw new Error("mock 云构建失败");
        this.patch(inst.id, {
          status: "running",
          artifact_seq: seqRow.m,
          log: "mock 云构建完成",
          deployed_at: now(),
          last_billed_at: now(),
        });
        return this.get(projectId)!;
      }

      const sources = parseStoredFiles(version.files);
      const stage = fs.mkdtempSync(path.join(os.tmpdir(), "fusion-cloud-"));
      try {
        if (sources) {
          // 工程引擎:上传源码,云端真实 vite 构建(日志可见)
          for (const [p, content] of Object.entries(sources)) {
            const full = path.join(stage, p);
            if (!full.startsWith(stage)) continue;
            fs.mkdirSync(path.dirname(full), { recursive: true });
            fs.writeFileSync(full, content);
          }
        } else {
          // 单文件引擎:平台构建产物注入助手后作为 dist 直传(云端跳过构建)
          fs.mkdirSync(path.join(stage, "dist"), { recursive: true });
          fs.writeFileSync(
            path.join(stage, "dist", "index.html"),
            exportAppHtml(version.html, project.slug, { platform: project.platform, connectors: project.connectors })
          );
        }
        const remoteApp = `~/fusion-cloud/apps/${project.slug}`;
        const uploadTarget = sources ? `${remoteApp}/source` : `${remoteApp}/dist.upload`;
        const up = await runShell(
          `tar czf - -C ${q(stage)} . | ssh ${HOST} ${q(`~/fusion-cloud/build-web.sh --clean ${project.slug} >/dev/null 2>&1 || true; mkdir -p ${uploadTarget} && tar xzf - -C ${uploadTarget}`)}`,
          120_000
        );
        if (up.code !== 0) throw new Error(`上传失败:${up.output.slice(-300)}`);

        if (sources) {
          const build = await runShell(`ssh ${HOST} ${q(`~/fusion-cloud/build-web.sh ${project.slug}`)}`, BUILD_TIMEOUT_MS);
          this.patch(inst.id, { log: build.output.slice(-LOG_CAP) });
          if (build.code !== 0) throw new Error("云端构建失败(详见日志)");
        } else {
          const mv = await runShell(
            `ssh ${HOST} ${q(`rmdir ${remoteApp}/dist 2>/dev/null || true; mv ${uploadTarget}/dist ${remoteApp}/dist && echo STATIC_OK`)}`,
            30_000
          );
          this.patch(inst.id, { log: mv.output.slice(-LOG_CAP) });
          if (mv.code !== 0 || !mv.output.includes("STATIC_OK")) throw new Error("静态产物就位失败");
        }
        this.patch(inst.id, {
          status: "running",
          artifact_seq: seqRow.m,
          deployed_at: now(),
          last_billed_at: now(),
        });
        return this.get(projectId)!;
      } finally {
        fs.rmSync(stage, { recursive: true, force: true });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "部署失败";
      this.patch(inst.id, { status: "error", error: message.slice(0, 400) });
      if (cost > 0) recordEvent(userId, cost, "refund:cloud-deploy");
      return this.get(projectId)!;
    } finally {
      this.busy = false;
    }
  }

  /** 停止:结清欠费小时后停止计费与访问。 */
  stop(projectId: string, reason = "manual"): CloudInstanceRow | undefined {
    const inst = this.get(projectId);
    if (!inst || inst.status !== "running") return inst;
    settleInstance(inst); // 停止前结清
    this.patch(inst.id, { status: "stopped", last_billed_at: null });
    if (reason === "autostop") recordEvent(inst.user_id, 0, `cloud-autostop:${inst.slug}`);
    return this.get(projectId);
  }

  /** 启动:恢复访问与计费(不重新构建)。 */
  start(projectId: string): CloudInstanceRow | undefined {
    const inst = this.get(projectId);
    if (!inst || inst.status !== "stopped") return inst;
    this.patch(inst.id, { status: "running", last_billed_at: now() });
    return this.get(projectId);
  }

  async remove(projectId: string): Promise<void> {
    const inst = this.get(projectId);
    if (!inst) return;
    if (inst.status === "running") this.stop(projectId);
    if (!MOCK) {
      await runShell(`ssh ${HOST} ${q(`~/fusion-cloud/build-web.sh --clean ${inst.slug}`)}`, 30_000);
    }
    db.prepare("DELETE FROM cloud_instances WHERE id = ?").run(inst.id);
  }
}

/** 对单实例按整小时补结;返回扣费小时数。余额不足时自动停机(由调用方触发 stop)。 */
function settleInstance(inst: CloudInstanceRow): { hours: number; ok: boolean } {
  if (inst.status !== "running" || !inst.last_billed_at) return { hours: 0, ok: true };
  const hours = Math.floor((now() - inst.last_billed_at) / 3_600_000);
  if (hours <= 0) return { hours: 0, ok: true };
  const amount = hours * inst.hourly_rate;
  const ok = charge(inst.user_id, amount, `cloud-hour:${inst.slug}`);
  if (ok) {
    db.prepare("UPDATE cloud_instances SET last_billed_at = ?, updated_at = ? WHERE id = ?").run(
      inst.last_billed_at + hours * 3_600_000,
      now(),
      inst.id
    );
  }
  return { hours, ok };
}

/** 全量结算:平台定时器与测试共用。余额不足的实例自动停机。 */
export function settleCloudBilling(): { settled: number; autostopped: string[] } {
  const running = cloudRunner.listRunning();
  let settled = 0;
  const autostopped: string[] = [];
  for (const inst of running) {
    const r = settleInstance(inst);
    if (r.hours > 0 && r.ok) settled++;
    if (!r.ok) {
      cloudRunner.stop(inst.project_id, "autostop");
      autostopped.push(inst.slug);
    }
  }
  return { settled, autostopped };
}

const g = globalThis as unknown as { __quarkCloud?: CloudRunner; __quarkCloudTimer?: ReturnType<typeof setInterval> };
export const cloudRunner: CloudRunner = g.__quarkCloud ?? (g.__quarkCloud = new CloudRunner());

// 计费循环:每 10 分钟补结整小时。测试/构建上下文不起定时器。
if (!g.__quarkCloudTimer && !process.env.VITEST && process.env.NEXT_PHASE !== "phase-production-build") {
  g.__quarkCloudTimer = setInterval(() => {
    try {
      settleCloudBilling();
    } catch {
      // 结算异常不致命,下轮重试
    }
  }, 10 * 60_000);
}
