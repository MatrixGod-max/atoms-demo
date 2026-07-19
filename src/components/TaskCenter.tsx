"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

interface TaskJob {
  id: string;
  projectId: string;
  projectName: string;
  status: "queued" | "running";
  stage: string | null;
  mode: string;
  position: number;
  createdAt: number;
}

interface RecentJob {
  projectId: string;
  projectName: string;
  status: "done" | "error";
  error?: string;
  finishedAt: number;
}

// 与 Builder.tsx 的 STAGE_LABELS 对应(源头在那里),此处只需短标。
const STAGE_SHORT: Record<string, string> = {
  researcher: "研究",
  fusion: "聚变分析",
  pm: "产品",
  architect: "架构",
  planner: "规划",
  engineer: "编码",
  build: "打包构建",
  reviewer: "评审",
  validator: "实测",
};

const MODE_ICON: Record<string, string> = { fast: "⚡", mixed: "🧠", deep: "🐢" };

function fmtElapsed(ms: number): string {
  const m = Math.floor(ms / 60_000);
  return m < 1 ? "刚刚开始" : `已用 ${m} 分钟`;
}

function fmtAgo(ms: number): string {
  const m = Math.floor(ms / 60_000);
  if (m < 1) return "刚刚";
  if (m < 60) return `${m} 分钟前`;
  return `${Math.floor(m / 60)} 小时前`;
}

/** Sidebar 任务入口(带进行中徽标)+ 右侧任务中心侧滑面板。 */
export default function TaskCenter({ collapsed = false }: { collapsed?: boolean }) {
  const [open, setOpen] = useState(false);
  const [jobs, setJobs] = useState<TaskJob[]>([]);
  const [recent, setRecent] = useState<RecentJob[]>([]);
  const [now, setNow] = useState(() => Date.now());

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/jobs");
      if (!res.ok) return;
      const d = await res.json();
      setJobs(d.jobs ?? []);
      setRecent(d.recent ?? []);
      setNow(Date.now());
    } catch {
      // transient network errors: keep last state
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(load, 0);
    const onChanged = () => load();
    const onOpen = () => {
      setOpen(true);
      load();
    };
    window.addEventListener("jobs-changed", onChanged);
    window.addEventListener("open-task-center", onOpen);
    return () => {
      clearTimeout(t);
      window.removeEventListener("jobs-changed", onChanged);
      window.removeEventListener("open-task-center", onOpen);
    };
  }, [load]);

  // 面板开着 4s 刷新;关着且有活跃任务时 15s(归零自停,无空转轮询)。
  useEffect(() => {
    if (!open && jobs.length === 0) return;
    const iv = setInterval(load, open ? 4000 : 15_000);
    return () => clearInterval(iv);
  }, [open, jobs.length, load]);

  const active = jobs.length;

  return (
    <>
      <button
        type="button"
        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-ink/80 hover:bg-bg/80 transition-colors"
        onClick={() => {
          setOpen(true);
          load();
        }}
        title="任务中心:所有进行中的构建"
      >
        <span className="w-4 text-center">⧗</span>
        {!collapsed && <span>任务</span>}
        {active > 0 && (
          <span className="ml-auto min-w-4 h-4 px-1 rounded-full bg-accent text-white text-[10px] flex items-center justify-center animate-pulse">
            {active}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/30" onClick={() => setOpen(false)} />
          <aside className="absolute right-0 top-0 bottom-0 w-80 max-w-[90vw] bg-bg-deep border-l border-line overflow-y-auto p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-sm">⧗ 任务中心</span>
              <button type="button" className="text-muted hover:text-ink text-sm" onClick={() => setOpen(false)} aria-label="关闭">
                ✕
              </button>
            </div>

            <p className="font-mono text-[10px] tracking-widest text-muted">进行中 · {active}</p>
            {active === 0 ? (
              <p className="text-xs text-muted py-2">暂无进行中的任务。去首页描述一个想法,或用 ⇉ 后台构建连发多个。</p>
            ) : (
              jobs.map((j) => (
                <div key={j.id} className="card p-3 text-xs flex flex-col gap-1.5">
                  <div className="flex items-center gap-2">
                    <span>{MODE_ICON[j.mode] ?? "⚡"}</span>
                    <Link
                      href={`/project/${j.projectId}`}
                      className="font-medium truncate flex-1 hover:text-accent"
                      onClick={() => setOpen(false)}
                    >
                      {j.projectName}
                    </Link>
                    <Link
                      href={`/project/${j.projectId}`}
                      className="text-muted hover:text-ink shrink-0"
                      onClick={() => setOpen(false)}
                    >
                      打开 ›
                    </Link>
                  </div>
                  <div className="flex items-center gap-2">
                    {j.status === "queued" ? (
                      <span className="text-amber">⏳ 排队中 · 第 {Math.max(j.position, 1)} 位</span>
                    ) : (
                      <span className="text-accent animate-pulse">⚙ {(j.stage && STAGE_SHORT[j.stage]) || "构建中"}</span>
                    )}
                    <span className="text-muted ml-auto">{fmtElapsed(now - j.createdAt)}</span>
                  </div>
                </div>
              ))
            )}

            {recent.length > 0 && (
              <>
                <p className="font-mono text-[10px] tracking-widest text-muted mt-2">最近完成 · 24h</p>
                {recent.map((r, i) => (
                  <Link
                    key={`${r.projectId}_${i}`}
                    href={`/project/${r.projectId}`}
                    className="flex items-start gap-2 text-xs px-1 py-0.5 rounded hover:bg-bg/80"
                    onClick={() => setOpen(false)}
                  >
                    <span className={r.status === "done" ? "text-good" : "text-bad"}>{r.status === "done" ? "✓" : "✗"}</span>
                    <span className="flex-1 min-w-0">
                      <span className="block truncate">{r.projectName}</span>
                      {r.error && <span className="block text-bad/80 line-clamp-2">{r.error}</span>}
                    </span>
                    <span className="text-muted shrink-0">{fmtAgo(now - r.finishedAt)}</span>
                  </Link>
                ))}
              </>
            )}
          </aside>
        </div>
      )}
    </>
  );
}
