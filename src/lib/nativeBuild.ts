/**
 * 原生打包服务:把项目源码送到远程构建机(ssh 驱动)产出 debug 签名 APK。
 * - Android:NATIVE_BUILD_HOST(默认 ubuntu@10.234.201.214,须先跑 scripts/setup-android-builder.sh)
 * - iOS:NATIVE_BUILD_IOS_HOST 未配置时创建即拒(当前 Mac 为 macOS 10.13,无法运行现代 Xcode)
 * - NATIVE_BUILD_MOCK=1:跳过 ssh,写占位 APK —— 测试/CI/smoke 全链路零依赖构建机
 * 并发 1、15 分钟超时;失败由调用方按 cost 退款语义处理(runner 回调退款)。
 */
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { db, now } from "./db";
import { newId } from "./auth";
import { recordEvent } from "./credits";
import { exportAppHtml } from "./serveApp";

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), "data");
const OUT_DIR = path.join(DATA_DIR, "native-builds");
const HOST = process.env.NATIVE_BUILD_HOST || "ubuntu@10.234.201.214";
const IOS_HOST = process.env.NATIVE_BUILD_IOS_HOST || "";
const MOCK = process.env.NATIVE_BUILD_MOCK === "1";
const BUILD_TIMEOUT_MS = 15 * 60_000;
const LOG_CAP = 8_000;

export type NativePlatform = "android" | "ios";

export interface NativeBuildRow {
  id: string;
  project_id: string;
  user_id: string;
  platform: NativePlatform;
  status: "queued" | "building" | "done" | "error";
  error: string | null;
  artifact_path: string | null;
  artifact_bytes: number | null;
  log: string | null;
  created_at: number;
  updated_at: number;
}

/** applicationId 必须是合法 Java 包名段:dev.fusion.a<项目id字母数字>。 */
export function appIdFor(projectId: string): string {
  return `dev.fusion.a${projectId.replace(/[^a-z0-9]/gi, "").toLowerCase().slice(0, 12) || "app"}`;
}

/** 进入远端 shell 单引号参数的应用名:去引号/反斜杠/控制符,保留中英文数字空格。 */
export function sanitizeAppName(name: string): string {
  const cleaned = name.replace(/[^\w一-龥 ·-]/g, "").trim().slice(0, 30);
  return cleaned || "FusionApp";
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

class NativeBuildRunner {
  private queue: string[] = [];
  private running = false;

  constructor() {
    // 孤儿清理:只处理超过构建超时窗口仍未落定的行。dev/HMR 下同库可能有多个进程,
    // 直接清活动行会踩别的进程正在跑的构建(实测踩过);超时窗口内的行一律不动。
    if (!process.env.VITEST && process.env.NEXT_PHASE !== "phase-production-build") {
      db.prepare(
        "UPDATE native_builds SET status='error', error='构建超时或进程重启', updated_at=? WHERE status IN ('queued','building') AND updated_at < ?"
      ).run(now(), now() - BUILD_TIMEOUT_MS - 60_000);
    }
  }

  activeForProject(projectId: string): NativeBuildRow | undefined {
    return db
      .prepare("SELECT * FROM native_builds WHERE project_id = ? AND status IN ('queued','building')")
      .get(projectId) as NativeBuildRow | undefined;
  }

  list(projectId: string, limit = 10): NativeBuildRow[] {
    return db
      .prepare("SELECT * FROM native_builds WHERE project_id = ? ORDER BY created_at DESC LIMIT ?")
      .all(projectId, limit) as unknown as NativeBuildRow[];
  }

  get(buildId: string): NativeBuildRow | undefined {
    return db.prepare("SELECT * FROM native_builds WHERE id = ?").get(buildId) as NativeBuildRow | undefined;
  }

  /** cost 仅用于失败退款流水。409 = 该项目已有构建进行中;iosUnavailable = 构建机未就绪。 */
  start(projectId: string, userId: string, platform: NativePlatform, cost: number): NativeBuildRow {
    if (platform === "ios" && !IOS_HOST && !MOCK) {
      const err = new Error(
        "iOS 构建机未就绪:当前 Mac(10.234.201.128)为 2018 款 macOS 10.13,无法运行 Capacitor 所需的 Xcode 15+;更换/升级后配置 NATIVE_BUILD_IOS_HOST 即启用"
      ) as Error & { code: number };
      err.code = 503;
      throw err;
    }
    const existing = this.activeForProject(projectId);
    if (existing) {
      const err = new Error("该项目已有打包任务在进行中") as Error & { code: number };
      err.code = 409;
      throw err;
    }
    const id = newId("nb");
    const t = now();
    db.prepare(
      "INSERT INTO native_builds (id, project_id, user_id, platform, status, created_at, updated_at) VALUES (?, ?, ?, ?, 'queued', ?, ?)"
    ).run(id, projectId, userId, platform, t, t);
    this.queue.push(JSON.stringify({ id, cost }));
    this.pump();
    return this.get(id)!;
  }

  private patch(id: string, fields: Partial<Pick<NativeBuildRow, "status" | "error" | "artifact_path" | "artifact_bytes" | "log">>) {
    const cur = this.get(id)!;
    const has = (k: string) => Object.prototype.hasOwnProperty.call(fields, k);
    db.prepare(
      "UPDATE native_builds SET status = ?, error = ?, artifact_path = ?, artifact_bytes = ?, log = ?, updated_at = ? WHERE id = ?"
    ).run(
      fields.status ?? cur.status,
      has("error") ? fields.error! : cur.error,
      fields.artifact_path ?? cur.artifact_path,
      fields.artifact_bytes ?? cur.artifact_bytes,
      fields.log ?? cur.log,
      now(),
      id
    );
  }

  private pump() {
    if (this.running) return;
    const next = this.queue.shift();
    if (!next) return;
    this.running = true;
    const { id, cost } = JSON.parse(next) as { id: string; cost: number };
    this.run(id, cost).finally(() => {
      this.running = false;
      this.pump();
    });
  }

  private async run(buildId: string, cost: number) {
    const build = this.get(buildId);
    if (!build) return;
    this.patch(buildId, { status: "building" });
    try {
      const project = db
        .prepare(
          "SELECT p.name, p.slug, p.current_version_id, p.published_version_id, p.connectors FROM projects p WHERE p.id = ?"
        )
        .get(build.project_id) as
        | { name: string; slug: string | null; current_version_id: string | null; published_version_id: string | null; connectors: string | null }
        | undefined;
      if (!project?.current_version_id) throw new Error("项目没有可打包的版本");
      const version = db
        .prepare("SELECT html FROM app_versions WHERE id = ?")
        .get(project.current_version_id) as { html: string };
      // APK 的 web 资产 = 平台已构建的自包含 HTML(与预览/发布完全一致,两种引擎统一)。
      // 已发布项目额外注入 storage/connectors 助手(经 CORS 回源)——APK 数据与云端同步。
      const shipHtml =
        project.slug && project.published_version_id
          ? exportAppHtml(version.html, project.slug, { platform: "mobile", connectors: project.connectors })
          : version.html;
      const sources: Record<string, string> = { "index.html": shipHtml };
      const engine = "single";

      fs.mkdirSync(OUT_DIR, { recursive: true });
      const artifactPath = path.join(OUT_DIR, `${buildId}.apk`);

      if (MOCK) {
        await new Promise((r) => setTimeout(r, 500));
        if (project.name.includes("MOCK_NATIVE_FAIL")) throw new Error("mock 构建失败");
        fs.writeFileSync(artifactPath, Buffer.concat([Buffer.from("PK\x03\x04"), Buffer.from("FUSION-MOCK-APK")]));
        this.patch(buildId, {
          status: "done",
          error: null,
          artifact_path: artifactPath,
          artifact_bytes: fs.statSync(artifactPath).size,
          log: "mock 构建完成",
        });
        return;
      }

      // 真实构建:源码落临时目录 → tar 流式上传 → 远端 build.sh → scp 取回 APK
      const stage = fs.mkdtempSync(path.join(os.tmpdir(), "fusion-nb-"));
      try {
        for (const [p, content] of Object.entries(sources)) {
          const full = path.join(stage, p);
          if (!full.startsWith(stage)) continue; // 路径已在入库时消毒,双保险
          fs.mkdirSync(path.dirname(full), { recursive: true });
          fs.writeFileSync(full, content);
        }
        const remoteWs = `~/fusion-android/ws/${buildId}`;
        const appId = appIdFor(build.project_id);
        const appName = sanitizeAppName(project.name);

        const upload = await runShell(
          `tar czf - -C ${q(stage)} . | ssh ${HOST} ${q(`mkdir -p ${remoteWs}/upload && tar xzf - -C ${remoteWs}/upload`)}`,
          120_000
        );
        if (upload.code !== 0) throw new Error(`上传失败:${upload.output.slice(-300)}`);

        const buildRes = await runShell(
          `ssh ${HOST} ${q(`~/fusion-android/build.sh ${buildId} ${appId} '${appName}' ${engine}`)}`,
          BUILD_TIMEOUT_MS
        );
        this.patch(buildId, { log: buildRes.output.slice(-LOG_CAP) });
        if (buildRes.code !== 0) throw new Error(`远端构建失败(详见日志)`);

        const fetch = await runShell(
          `scp ${HOST}:${remoteWs}/app/android/app/build/outputs/apk/debug/app-debug.apk ${q(artifactPath)}`,
          120_000
        );
        if (fetch.code !== 0 || !fs.existsSync(artifactPath)) throw new Error(`取回 APK 失败:${fetch.output.slice(-300)}`);

        this.patch(buildId, {
          status: "done",
          error: null,
          artifact_path: artifactPath,
          artifact_bytes: fs.statSync(artifactPath).size,
        });
        // 成功即清远端工作区;失败保留现场供排查(占用可控,人工/下次安装脚本清理)
        void runShell(`ssh ${HOST} ${q(`rm -rf ~/fusion-android/ws/${buildId}`)}`, 30_000);
      } finally {
        fs.rmSync(stage, { recursive: true, force: true });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "构建失败";
      this.patch(buildId, { status: "error", error: message.slice(0, 500) });
      if (cost > 0) recordEvent(build.user_id, cost, "refund:native-build");
    }
  }
}

const g = globalThis as unknown as { __quarkNativeBuilds?: NativeBuildRunner };
export const nativeBuildRunner: NativeBuildRunner = g.__quarkNativeBuilds ?? (g.__quarkNativeBuilds = new NativeBuildRunner());
