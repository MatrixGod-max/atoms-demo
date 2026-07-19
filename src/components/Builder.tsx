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
  };
  messages: Message[];
  versions: Version[];
  currentHtml: string | null;
}

interface Spec {
  name: string;
  summary: string;
  features: string[];
  design: string;
}

type StageName = "planner" | "engineer" | "reviewer";
type StageState = "idle" | "active" | "done";

const STAGE_LABELS: Record<StageName, string> = {
  planner: "Planner · 规划",
  engineer: "Engineer · 构建",
  reviewer: "Reviewer · 评审",
};

export default function Builder({ projectId }: { projectId: string }) {
  const [detail, setDetail] = useState<ProjectDetail | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [generating, setGenerating] = useState(false);
  const [stages, setStages] = useState<Record<StageName, { state: StageState; info?: string }>>({
    planner: { state: "idle" },
    engineer: { state: "idle" },
    reviewer: { state: "idle" },
  });
  const [spec, setSpec] = useState<Spec | null>(null);
  const [streamCode, setStreamCode] = useState("");
  const [html, setHtml] = useState<string | null>(null);
  const [tab, setTab] = useState<"preview" | "code">("preview");
  const [publishBusy, setPublishBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const codeRef = useRef<HTMLPreElement>(null);
  const bootedRef = useRef(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/projects/${projectId}`);
    if (!res.ok) return null;
    const data = (await res.json()) as ProjectDetail;
    setDetail(data);
    setMessages(data.messages);
    setHtml(data.currentHtml);
    return data;
  }, [projectId]);

  const generate = useCallback(
    async (prompt: string) => {
      setGenerating(true);
      setSpec(null);
      setStreamCode("");
      setTab("code");
      setStages({ planner: { state: "idle" }, engineer: { state: "idle" }, reviewer: { state: "idle" } });
      setMessages((m) => [...m, { id: `tmp_${Date.now()}`, role: "user", content: prompt }]);

      try {
        const res = await fetch(`/api/projects/${projectId}/generate`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ prompt }),
        });
        if (!res.ok || !res.body) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || `请求失败 (${res.status})`);
        }
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
            if (payload === "[DONE]") continue;
            const event = JSON.parse(payload);
            switch (event.type) {
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
                setMessages((m) => [
                  ...m,
                  { id: `tmp_e_${Date.now()}`, role: "agent", content: `生成失败:${event.message}`, meta: "error" },
                ]);
                break;
            }
          }
        }
        const data = await load();
        if (data?.currentHtml) setTab("preview");
      } catch (err) {
        const message = err instanceof Error ? err.message : "网络错误";
        setMessages((m) => [
          ...m,
          { id: `tmp_e_${Date.now()}`, role: "agent", content: `生成失败:${message}`, meta: "error" },
        ]);
      } finally {
        setGenerating(false);
      }
    },
    [projectId, load]
  );

  // Initial load + auto-start for a freshly created project.
  useEffect(() => {
    (async () => {
      const data = await load();
      if (bootedRef.current || !data) return;
      bootedRef.current = true;
      const pending = sessionStorage.getItem(`quark_pending_${projectId}`);
      if (pending && data.versions.length === 0) {
        sessionStorage.removeItem(`quark_pending_${projectId}`);
        generate(pending);
      }
    })();
  }, [load, generate, projectId]);

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
    }
  }

  async function publish() {
    if (publishBusy) return;
    setPublishBusy(true);
    const res = await fetch(`/api/projects/${projectId}/publish`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "publish" }),
    });
    if (res.ok) await load();
    setPublishBusy(false);
  }

  const project = detail?.project;
  const versions = detail?.versions ?? [];
  const currentNum = versions.find((v) => v.id === project?.current_version_id)?.num;
  const publishedUrl = project?.published_version_id && project.slug ? `/p/${project.slug}` : null;
  const publishOutdated =
    !!publishedUrl && project?.published_version_id !== project?.current_version_id;

  return (
    <div className="flex-1 flex flex-col h-dvh">
      <header className="flex items-center gap-3 px-4 py-3 border-b border-line shrink-0">
        <Link href="/dashboard" className="btn-ghost px-3 py-1.5 text-xs shrink-0">
          ← 工作台
        </Link>
        <h1 className="font-semibold text-sm truncate flex-1">{project?.name ?? "加载中…"}</h1>
        {versions.length > 0 && (
          <select
            className="input px-2 py-1.5 text-xs font-mono"
            value={project?.current_version_id ?? ""}
            onChange={(e) => rollback(e.target.value)}
            disabled={generating}
            aria-label="切换版本"
          >
            {versions.map((v) => (
              <option key={v.id} value={v.id}>
                v{v.num} · {v.prompt.slice(0, 16)}
              </option>
            ))}
          </select>
        )}
        {publishedUrl && (
          <button
            className="btn-ghost px-3 py-1.5 text-xs font-mono text-good"
            onClick={() => {
              navigator.clipboard.writeText(`${location.origin}${publishedUrl}`);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }}
            title="复制公开链接"
          >
            {copied ? "已复制 ✓" : `⚛ ${publishedUrl}`}
          </button>
        )}
        <button
          className="btn-primary px-4 py-1.5 text-xs shrink-0"
          onClick={publish}
          disabled={publishBusy || generating || !project?.current_version_id}
        >
          {publishBusy ? "发布中…" : publishOutdated ? "更新发布" : publishedUrl ? "重新发布" : "发布"}
        </button>
      </header>

      <div className="flex-1 flex min-h-0">
        {/* left: conversation + agent timeline */}
        <aside className="w-[400px] shrink-0 border-r border-line flex flex-col min-h-0 max-sm:w-full">
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
                <p className="font-mono text-[10px] tracking-widest text-muted mb-3">AGENT PIPELINE</p>
                <div className="flex flex-col gap-3">
                  {(Object.keys(STAGE_LABELS) as StageName[]).map((name) => (
                    <div key={name} className="flex items-center gap-3">
                      <span className={`stage-dot ${stages[name].state === "active" ? "active" : ""} ${stages[name].state === "done" ? "done" : ""}`} />
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
        <section className="flex-1 flex flex-col min-h-0 max-sm:hidden">
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
                <iframe
                  className="w-full h-full bg-white"
                  sandbox="allow-scripts allow-same-origin allow-forms allow-modals allow-popups"
                  srcDoc={html}
                  title="应用预览"
                />
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
    </div>
  );
}
