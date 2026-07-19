"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

interface Message {
  id: string;
  role: "user" | "agent";
  content: string;
  meta?: string | null;
}

interface Version {
  id: string;
  num: number;
  review_notes: string | null;
  prompt: string;
  created_at: number;
}

interface ProjectDetail {
  project: {
    id: string;
    name: string;
    slug: string | null;
    current_version_id: string | null;
    published_version_id: string | null;
    in_gallery: number;
    platform: "web" | "mobile";
  };
  messages: Message[];
  versions: Version[];
  currentHtml: string | null;
  activeJob: { id: string; status: string; stage: string | null } | null;
}

interface Spec {
  name: string;
  summary: string;
  features: string[];
  design: string;
}

type StageName = "planner" | "engineer" | "reviewer" | "validator";
type StageState = "idle" | "active" | "done";

const STAGE_LABELS: Record<StageName, string> = {
  planner: "Planner · 规划",
  engineer: "Engineer · 构建",
  reviewer: "Reviewer · 评审",
  validator: "Validator · 实测",
};

const IDLE_STAGES: Record<StageName, { state: StageState; info?: string }> = {
  planner: { state: "idle" },
  engineer: { state: "idle" },
  reviewer: { state: "idle" },
  validator: { state: "idle" },
};

const MAX_RECONNECTS = 5;

export default function Builder({ projectId }: { projectId: string }) {
  const [detail, setDetail] = useState<ProjectDetail | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [generating, setGenerating] = useState(false);
  const [stages, setStages] = useState<Record<StageName, { state: StageState; info?: string }>>(IDLE_STAGES);
  const [spec, setSpec] = useState<Spec | null>(null);
  const [streamCode, setStreamCode] = useState("");
  const [html, setHtml] = useState<string | null>(null);
  const [tab, setTab] = useState<"preview" | "code">("preview");
  const [mobilePane, setMobilePane] = useState<"chat" | "app">("chat");
  const [publishBusy, setPublishBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [queuePos, setQueuePos] = useState(0);
  const [reconnecting, setReconnecting] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [nameDraft, setNameDraft] = useState("");

  const chatEndRef = useRef<HTMLDivElement>(null);
  const codeRef = useRef<HTMLPreElement>(null);
  const bootedRef = useRef(false);

  const pushError = useCallback((text: string) => {
    setMessages((m) => [...m, { id: `tmp_e_${Date.now()}`, role: "agent", content: text, meta: "error" }]);
  }, []);

  const load = useCallback(async () => {
    const res = await fetch(`/api/projects/${projectId}`);
    if (res.status === 401) {
      location.href = "/login";
      return null;
    }
    if (!res.ok) return null;
    const data = (await res.json()) as ProjectDetail;
    setDetail(data);
    setMessages(data.messages);
    setHtml(data.currentHtml);
    return data;
  }, [projectId]);

  const resetRunState = useCallback(() => {
    setSpec(null);
    setStreamCode("");
    setQueuePos(0);
    setTab("code");
    setStages(IDLE_STAGES);
  }, []);

  /** One pass over the job SSE stream. Returns true when a terminal marker was seen. */
  const streamOnce = useCallback(
    async (jobId: string): Promise<boolean> => {
      const res = await fetch(`/api/jobs/${jobId}/stream`);
      if (res.status === 401) {
        location.href = "/login";
        return true;
      }
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `请求失败 (${res.status})`);
      }
      let sawTerminal = false;
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const chunks = buf.split("\n\n");
        buf = chunks.pop() ?? "";
        for (const chunk of chunks) {
          const line = chunk.trim();
          if (!line.startsWith("data:")) continue;
          const payload = line.slice(5).trim();
          if (payload === "[DONE]") {
            sawTerminal = true;
            continue;
          }
          const event = JSON.parse(payload);
          switch (event.type) {
            case "queued":
              setQueuePos(event.position);
              break;
            case "job_state":
              if (event.status === "running") setQueuePos(0);
              if (event.status === "done" || event.status === "error") sawTerminal = true;
              if (event.status === "error" && event.error === "服务重启,任务中断") {
                pushError(`生成失败:${event.error}`);
              }
              break;
            case "stage":
              setStages((s) => ({
                ...s,
                [event.stage as StageName]: {
                  state: event.status === "start" ? "active" : "done",
                  info: event.info,
                },
              }));
              break;
            case "plan":
              setSpec(event.spec);
              break;
            case "code_delta":
              setStreamCode((c) => c + event.delta);
              break;
            case "code_reset":
              setStreamCode("");
              break;
            case "agent_message":
              setMessages((m) => [...m, { id: `tmp_a_${Date.now()}`, role: "agent", content: event.content }]);
              break;
            case "error":
              pushError(`生成失败:${event.message}`);
              break;
          }
        }
      }
      return sawTerminal;
    },
    [pushError]
  );

  /** Attach to a job with automatic reconnection while the job is still alive. */
  const attachJob = useCallback(
    async (jobId: string) => {
      setGenerating(true);
      try {
        let attempts = 0;
        while (true) {
          try {
            const terminal = await streamOnce(jobId);
            if (terminal) break;
            // Stream closed without a terminal marker (proxy timeout / network blip).
            throw new Error("stream dropped");
          } catch (err) {
            attempts++;
            if (attempts > MAX_RECONNECTS) throw err;
            setReconnecting(true);
            await new Promise((r) => setTimeout(r, 2000));
            const res = await fetch(`/api/projects/${projectId}`);
            if (res.status === 401) {
              location.href = "/login";
              return;
            }
            const d = res.ok ? ((await res.json()) as ProjectDetail) : null;
            setReconnecting(false);
            if (!d?.activeJob || d.activeJob.id !== jobId) break; // job finished while we were away
            resetRunState(); // replay will rebuild the timeline and code
          }
        }
        const data = await load();
        if (data?.currentHtml) setTab("preview");
      } catch (err) {
        pushError(`生成失败:${err instanceof Error ? err.message : "网络错误"}`);
      } finally {
        setGenerating(false);
        setReconnecting(false);
        setQueuePos(0);
      }
    },
    [projectId, streamOnce, load, resetRunState, pushError]
  );

  const generate = useCallback(
    async (prompt: string) => {
      setGenerating(true);
      resetRunState();
      setMessages((m) => [...m, { id: `tmp_${Date.now()}`, role: "user", content: prompt }]);
      try {
        const res = await fetch(`/api/projects/${projectId}/generate`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ prompt }),
        });
        const data = await res.json().catch(() => ({}));
        if (res.status === 401) {
          location.href = "/login";
          return;
        }
        if (res.status === 409 && data.jobId) {
          await attachJob(data.jobId);
          return;
        }
        if (!res.ok) throw new Error(data.error || `请求失败 (${res.status})`);
        if (data.position > 0) setQueuePos(data.position);
        await attachJob(data.jobId);
      } catch (err) {
        pushError(`生成失败:${err instanceof Error ? err.message : "网络错误"}`);
        setGenerating(false);
      }
    },
    [projectId, attachJob, resetRunState, pushError]
  );

  // Initial load: reconnect to a live job if one exists, else auto-start a freshly created project.
  useEffect(() => {
    (async () => {
      const data = await load();
      if (bootedRef.current || !data) return;
      bootedRef.current = true;
      if (data.activeJob) {
        resetRunState();
        attachJob(data.activeJob.id);
        return;
      }
      const pending = sessionStorage.getItem(`quark_pending_${projectId}`);
      if (pending && data.versions.length === 0) {
        sessionStorage.removeItem(`quark_pending_${projectId}`);
        generate(pending);
      }
    })();
  }, [load, generate, attachJob, resetRunState, projectId]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, spec, generating]);

  useEffect(() => {
    if (codeRef.current) codeRef.current.scrollTop = codeRef.current.scrollHeight;
  }, [streamCode]);

  function send() {
    const prompt = input.trim();
    if (!prompt || generating) return;
    setInput("");
    generate(prompt);
  }

  async function rollback(versionId: string) {
    const res = await fetch(`/api/projects/${projectId}/rollback`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ versionId }),
    });
    if (res.ok) {
      const { html: rolledHtml } = await res.json();
      setHtml(rolledHtml);
      setTab("preview");
      load();
    } else {
      const data = await res.json().catch(() => ({}));
      if (data.error) pushError(data.error);
    }
  }

  async function publishAction(action: "publish" | "unpublish") {
    if (publishBusy) return;
    if (action === "unpublish" && !confirm("取消发布后,公开链接将无法访问。确定吗?")) return;
    setPublishBusy(true);
    const res = await fetch(`/api/projects/${projectId}/publish`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action }),
    });
    if (res.ok) await load();
    else {
      const data = await res.json().catch(() => ({}));
      if (data.error) pushError(data.error);
    }
    setPublishBusy(false);
  }

  async function patchProject(body: { name?: string; inGallery?: boolean }) {
    const res = await fetch(`/api/projects/${projectId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) await load();
    else {
      const data = await res.json().catch(() => ({}));
      if (data.error) pushError(data.error);
    }
  }

  const project = detail?.project;
  const versions = detail?.versions ?? [];
  const appsOrigin = process.env.NEXT_PUBLIC_APPS_ORIGIN;
  const publishedUrl =
    project?.published_version_id && project.slug
      ? appsOrigin
        ? `${appsOrigin}/${project.slug}`
        : `/p/${project.slug}`
      : null;
  const publishOutdated = !!publishedUrl && project?.published_version_id !== project?.current_version_id;

  // Retry: the conversation ended in a failure — offer to rerun the last request.
  const lastMessage = messages[messages.length - 1];
  const retryPrompt =
    !generating && lastMessage?.meta === "error"
      ? [...messages].reverse().find((m) => m.role === "user")?.content ?? null
      : null;

  return (
    <div className="flex-1 flex flex-col h-dvh">
      <header className="flex items-center gap-3 px-4 py-3 border-b border-line shrink-0 flex-wrap">
        <Link href="/dashboard" className="btn-ghost px-3 py-1.5 text-xs shrink-0">
          ← 工作台
        </Link>
        {renaming ? (
          <input
            className="input px-2 py-1 text-sm flex-1 min-w-32"
            value={nameDraft}
            autoFocus
            maxLength={40}
            onChange={(e) => setNameDraft(e.target.value)}
            onBlur={() => setRenaming(false)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                setRenaming(false);
                if (nameDraft.trim() && nameDraft.trim() !== project?.name) patchProject({ name: nameDraft });
              }
              if (e.key === "Escape") setRenaming(false);
            }}
          />
        ) : (
          <h1
            className="font-semibold text-sm truncate flex-1 cursor-text"
            title="双击重命名"
            onDoubleClick={() => {
              setNameDraft(project?.name ?? "");
              setRenaming(true);
            }}
          >
            {project && (
              <span className="mr-1.5" title={project.platform === "mobile" ? "移动应用" : "网页应用"}>
                {project.platform === "mobile" ? "📱" : "🌐"}
              </span>
            )}
            {project?.name ?? "加载中…"}
          </h1>
        )}
        {versions.length > 0 && (
          <select
            className="input px-2 py-1.5 text-xs font-mono"
            value={project?.current_version_id ?? ""}
            onChange={(e) => rollback(e.target.value)}
            disabled={generating}
            aria-label="切换版本"
          >
            {versions.map((v) => (
              <option key={v.id} value={v.id} title={v.review_notes ?? undefined}>
                v{v.num} · {v.prompt.slice(0, 16)}
              </option>
            ))}
          </select>
        )}
        {publishedUrl && (
          <>
            <button
              className="btn-ghost px-3 py-1.5 text-xs font-mono text-good max-sm:hidden"
              onClick={() => {
                navigator.clipboard.writeText(
                  publishedUrl.startsWith("http") ? publishedUrl : `${location.origin}${publishedUrl}`
                );
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }}
              title="复制公开链接"
            >
              {copied ? "已复制 ✓" : `⚛ ${publishedUrl.replace(/^https?:\/\//, "")}`}
            </button>
            <Link
              href={`/artifact/${project?.slug}`}
              className="btn-ghost px-3 py-1.5 text-xs max-sm:hidden"
              title="制品发布历史"
            >
              制品页 ↗
            </Link>
            <label className="flex items-center gap-1.5 text-xs text-muted cursor-pointer max-sm:hidden" title="展示在公开展厅 /explore">
              <input
                type="checkbox"
                checked={!!project?.in_gallery}
                onChange={(e) => patchProject({ inGallery: e.target.checked })}
              />
              展厅
            </label>
            <button
              className="btn-ghost px-2 py-1.5 text-xs text-muted hover:text-bad"
              onClick={() => publishAction("unpublish")}
              disabled={publishBusy}
              title="取消发布"
            >
              下线
            </button>
          </>
        )}
        <button
          className="btn-primary px-4 py-1.5 text-xs shrink-0"
          onClick={() => publishAction("publish")}
          disabled={publishBusy || generating || !project?.current_version_id}
        >
          {publishBusy ? "处理中…" : publishOutdated ? "更新发布" : publishedUrl ? "重新发布" : "发布"}
        </button>
      </header>

      <div className="flex-1 flex min-h-0">
        {/* left: conversation + agent timeline */}
        <aside
          className={`w-[400px] shrink-0 border-r border-line flex-col min-h-0 max-sm:w-full flex ${
            mobilePane === "chat" ? "max-sm:flex" : "max-sm:hidden"
          }`}
        >
          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
            {messages.map((m) => (
              <div
                key={m.id}
                className={
                  m.role === "user"
                    ? "self-end max-w-[85%] bg-accent-soft border border-line rounded-xl rounded-br-sm px-3.5 py-2.5 text-sm whitespace-pre-wrap"
                    : `self-start max-w-[92%] text-sm whitespace-pre-wrap leading-relaxed ${m.meta === "error" ? "text-bad" : "text-ink"}`
                }
              >
                {m.role === "agent" && <span className="text-accent mr-1.5">⚛</span>}
                {m.content}
              </div>
            ))}

            {retryPrompt && (
              <button
                className="btn-ghost px-3 py-1.5 text-xs self-start"
                onClick={() => generate(retryPrompt)}
              >
                ↻ 重试上次请求
              </button>
            )}

            {spec && (
              <div className="spec-chip p-3 text-xs self-start max-w-[92%]">
                <p className="font-mono text-[10px] tracking-widest text-amber mb-1.5">PLANNER SPEC</p>
                <p className="font-semibold text-sm">{spec.name}</p>
                <p className="text-muted mt-1">{spec.summary}</p>
                <ul className="mt-2 space-y-1 text-muted">
                  {spec.features.map((f) => (
                    <li key={f}>· {f}</li>
                  ))}
                </ul>
              </div>
            )}

            {generating && (
              <div className="card p-4 self-stretch">
                <p className="font-mono text-[10px] tracking-widest text-muted mb-3">
                  AGENT PIPELINE
                  {queuePos > 0 && <span className="text-amber ml-2">排队中 · 第 {queuePos} 位</span>}
                  {reconnecting && <span className="text-amber ml-2">连接中断,正在重连…</span>}
                </p>
                <div className="flex flex-col gap-3">
                  {(Object.keys(STAGE_LABELS) as StageName[]).map((name) => (
                    <div key={name} className="flex items-center gap-3">
                      <span
                        className={`stage-dot ${stages[name].state === "active" ? "active" : ""} ${stages[name].state === "done" ? "done" : ""}`}
                      />
                      <span className={`text-xs font-mono ${stages[name].state === "idle" ? "text-muted" : "text-ink"}`}>
                        {STAGE_LABELS[name]}
                      </span>
                      {stages[name].info && (
                        <span className="text-[11px] text-muted truncate flex-1">{stages[name].info}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          <div className="p-3 border-t border-line shrink-0">
            <div className="flex gap-2">
              <textarea
                className="input flex-1 px-3 py-2 text-sm resize-none"
                rows={2}
                placeholder={generating ? "智能体工作中…" : "继续提需求,例如:加一个深色模式开关"}
                value={input}
                disabled={generating}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
              />
              <button className="btn-primary px-4 text-sm" onClick={send} disabled={generating || !input.trim()}>
                发送
              </button>
            </div>
          </div>
        </aside>

        {/* right: preview / code */}
        <section
          className={`flex-1 flex-col min-h-0 flex ${mobilePane === "app" ? "max-sm:flex" : "max-sm:hidden"}`}
        >
          <div className="flex items-center gap-1 px-3 py-2 border-b border-line shrink-0">
            {(["preview", "code"] as const).map((t) => (
              <button
                key={t}
                className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${tab === t ? "bg-accent-soft text-ink" : "text-muted hover:text-ink"}`}
                onClick={() => setTab(t)}
              >
                {t === "preview" ? "预览" : "代码"}
              </button>
            ))}
            {generating && (
              <span className="ml-auto font-mono text-[11px] text-amber animate-pulse">
                ● {streamCode ? `${streamCode.length} 字符` : "思考中"}
              </span>
            )}
          </div>
          <div className="flex-1 min-h-0 bg-bg-deep">
            {tab === "preview" ? (
              html ? (
                <div className="h-full flex flex-col">
                  <p className="px-3 py-1 text-[11px] text-muted border-b border-line shrink-0">
                    沙箱预览 · 预览中数据不持久,发布后云存储生效
                    {project?.platform === "mobile" && " · 390×844 手机视口"}
                  </p>
                  {project?.platform === "mobile" ? (
                    <div className="flex-1 min-h-0 flex items-center justify-center p-4 overflow-auto">
                      <div className="w-[390px] max-w-full h-full max-h-[780px] rounded-[32px] border-[6px] border-[#2a2d4a] shadow-2xl overflow-hidden bg-white shrink-0">
                        <iframe
                          className="w-full h-full bg-white"
                          sandbox="allow-scripts allow-forms allow-modals allow-popups"
                          srcDoc={html}
                          title="应用预览"
                        />
                      </div>
                    </div>
                  ) : (
                    <iframe
                      className="w-full flex-1 bg-white"
                      sandbox="allow-scripts allow-forms allow-modals allow-popups"
                      srcDoc={html}
                      title="应用预览"
                    />
                  )}
                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-muted text-sm gap-2">
                  <span className="text-3xl">⚛</span>
                  {generating ? "首个版本正在构建,可切到「代码」页观看实况" : "还没有版本。在左侧描述你的需求开始构建。"}
                </div>
              )
            ) : (
              <pre ref={codeRef} className="code-stream h-full overflow-y-auto p-4">
                {streamCode || html || "// 暂无代码"}
              </pre>
            )}
          </div>
        </section>
      </div>

      {/* mobile pane switcher */}
      <nav className="sm:hidden flex border-t border-line shrink-0">
        {(
          [
            ["chat", "对话"],
            ["app", "应用"],
          ] as const
        ).map(([pane, label]) => (
          <button
            key={pane}
            className={`flex-1 py-2.5 text-sm ${mobilePane === pane ? "text-accent font-semibold" : "text-muted"}`}
            onClick={() => setMobilePane(pane)}
          >
            {label}
            {pane === "app" && generating && <span className="text-amber ml-1 animate-pulse">●</span>}
          </button>
        ))}
      </nav>
    </div>
  );
}
