"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { THEME_PRESETS } from "@/lib/launch";
import { useSpeech } from "@/lib/useSpeech";

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
    theme: string | null;
    connectors: string | null;
    domain_name: string | null;
  };
  messages: Message[];
  versions: Version[];
  currentHtml: string | null;
  attachments: AttachmentMeta[];
  deployments: Deployment[];
  deployTargets: DeployTarget[];
  activeJob: { id: string; status: string; stage: string | null } | null;
}

interface Deployment {
  id: string;
  provider: string;
  url: string;
  status: "live" | "removed";
  created_at: number;
}

interface DeployTarget {
  id: string;
  name: string;
  status: "available" | "experimental" | "planned";
  note: string;
}

interface AttachmentMeta {
  id: string;
  filename: string;
  mime: string;
  kind: "text" | "image";
  size: number;
}

interface Spec {
  name: string;
  summary: string;
  features: string[];
  design: string;
}

type StageName = "researcher" | "pm" | "architect" | "planner" | "engineer" | "reviewer" | "validator";
type StageState = "idle" | "active" | "done";

const STAGE_LABELS: Record<StageName, string> = {
  researcher: "Researcher · 研究",
  pm: "PM · 产品",
  architect: "Architect · 架构",
  planner: "Planner · 规划",
  engineer: "Engineer · 构建",
  reviewer: "Reviewer · 评审",
  validator: "Validator · 实测",
};

const IDLE_STAGES: Record<StageName, { state: StageState; info?: string; model?: string }> = {
  researcher: { state: "idle" },
  pm: { state: "idle" },
  architect: { state: "idle" },
  planner: { state: "idle" },
  engineer: { state: "idle" },
  reviewer: { state: "idle" },
  validator: { state: "idle" },
};

const GEN_MODES = [
  ["fast", "⚡ 快速", "全阶段 DeepSeek V3:最快,日常迭代首选"],
  ["mixed", "🧠 混合", "R1 负责研究/规划/评审(想得深),V3 负责编码(写得快)"],
  ["deep", "🐢 深度", "全阶段 R1:最强推理,速度最慢"],
] as const;

const MAX_RECONNECTS = 5;

export default function Builder({ projectId }: { projectId: string }) {
  const [detail, setDetail] = useState<ProjectDetail | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [generating, setGenerating] = useState(false);
  const [stages, setStages] = useState<Record<StageName, { state: StageState; info?: string; model?: string }>>(IDLE_STAGES);
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
  const [attachments, setAttachments] = useState<AttachmentMeta[]>([]);
  const [research, setResearch] = useState(false);
  const [team, setTeam] = useState(false);
  const [targetOpen, setTargetOpen] = useState(false);
  const [connOpen, setConnOpen] = useState(false);
  const [domainDraft, setDomainDraft] = useState("");
  const [domainBusy, setDomainBusy] = useState(false);
  const speech = useSpeech((text) => setInput((v) => (v ? `${v}${text}` : text)));
  const [genMode, setGenMode] = useState<"fast" | "mixed" | "deep">("fast");
  const [previewReady, setPreviewReady] = useState(false);
  const [themeOpen, setThemeOpen] = useState(false);
  const [deployOpen, setDeployOpen] = useState(false);
  const [deployBusy, setDeployBusy] = useState("");
  const [netlifyToken, setNetlifyToken] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    setAttachments(data.attachments ?? []);
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
                  model: event.model ?? s[event.stage as StageName]?.model,
                },
              }));
              break;
            case "plan":
              setSpec(event.spec);
              break;
            case "research":
              setMessages((m) => [
                ...m,
                { id: `tmp_r_${Date.now()}`, role: "agent", content: JSON.stringify(event.brief), meta: "research" },
              ]);
              break;
            case "pm":
              setMessages((m) => [
                ...m,
                { id: `tmp_pm_${Date.now()}`, role: "agent", content: JSON.stringify(event.stories), meta: "pm" },
              ]);
              break;
            case "architect":
              setMessages((m) => [
                ...m,
                { id: `tmp_ar_${Date.now()}`, role: "agent", content: JSON.stringify(event.blueprint), meta: "architect" },
              ]);
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
        if (data?.currentHtml) {
          setTab("preview");
          setPreviewReady(true);
        }
      } catch (err) {
        pushError(`生成失败:${err instanceof Error ? err.message : "网络错误"}`);
      } finally {
        setGenerating(false);
        setReconnecting(false);
        setQueuePos(0);
        window.dispatchEvent(new Event("credits-changed"));
      }
    },
    [projectId, streamOnce, load, resetRunState, pushError]
  );

  const generate = useCallback(
    async (prompt: string, researchOverride?: boolean, teamOverride?: boolean, modeOverride?: "fast" | "mixed" | "deep") => {
      setGenerating(true);
      resetRunState();
      setMessages((m) => [...m, { id: `tmp_${Date.now()}`, role: "user", content: prompt }]);
      try {
        const res = await fetch(`/api/projects/${projectId}/generate`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ prompt, research: researchOverride ?? research, team: teamOverride ?? team, mode: modeOverride ?? genMode }),
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
    [projectId, research, team, genMode, attachJob, resetRunState, pushError]
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
        // New launches store JSON {prompt, research}; legacy values are the plain prompt string.
        let bootPrompt = pending;
        let bootResearch = false;
        let bootTeam = false;
        let bootMode: "fast" | "mixed" | "deep" = "fast";
        try {
          const parsed = JSON.parse(pending);
          if (parsed && typeof parsed.prompt === "string") {
            bootPrompt = parsed.prompt;
            bootResearch = !!parsed.research;
            bootTeam = !!parsed.team;
            if (parsed.mode === "mixed" || parsed.mode === "deep") bootMode = parsed.mode;
          }
        } catch {
          // legacy plain-string pending value
        }
        if (bootResearch) setResearch(true);
        if (bootTeam) setTeam(true);
        if (bootMode !== "fast") setGenMode(bootMode);
        generate(bootPrompt, bootResearch, bootTeam, bootMode);
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

  async function patchProject(body: { name?: string; inGallery?: boolean; platform?: "web" | "mobile"; theme?: string | null; connectors?: string[]; domainName?: string | null }) {
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

  async function uploadFile(file: File) {
    const buf = await file.arrayBuffer();
    let binary = "";
    const bytes = new Uint8Array(buf);
    for (let i = 0; i < bytes.length; i += 0x8000) {
      binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    }
    const mime = file.type || (file.name.endsWith(".md") ? "text/markdown" : "text/plain");
    const res = await fetch(`/api/projects/${projectId}/attachments`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ filename: file.name, mime, dataBase64: btoa(binary) }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) setAttachments(data.attachments);
    else pushError(data.error || "上传失败");
  }

  async function removeAttachment(attId: string) {
    const res = await fetch(`/api/projects/${projectId}/attachments/${attId}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    if (res.ok) setAttachments(data.attachments);
  }

  async function runDeploy(provider: string) {
    if (deployBusy) return;
    setDeployBusy(provider);
    const res = await fetch(`/api/projects/${projectId}/deploy`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ provider, token: provider === "netlify" ? netlifyToken : undefined }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) await load();
    else pushError(data.error || "部署失败");
    setDeployBusy("");
  }

  async function undeploy(depId: string) {
    if (!confirm("下线该部署?(S3 会删除对应 bucket)")) return;
    const res = await fetch(`/api/projects/${projectId}/deploy/${depId}`, { method: "DELETE" });
    if (res.ok) await load();
    else pushError((await res.json().catch(() => ({}))).error || "下线失败");
  }

  async function switchTheme(theme: string | null) {
    setThemeOpen(false);
    await patchProject(theme ? { theme } : ({ theme: null } as never));
    generate(
      theme
        ? `【主题变换】把应用整体视觉主题切换为「${theme}」:只调整配色、字体气质、圆角、阴影、背景等视觉层,布局结构、功能逻辑、文案与数据处理完全保持不变。`
        : "【主题变换】把应用视觉恢复为默认的现代简洁风格:只调整视觉层,布局结构、功能逻辑、文案与数据处理完全保持不变。"
    );
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
            {project?.name ?? "加载中…"}
          </h1>
        )}
        {project && (
          <div className="relative">
            <button
              className="btn-ghost px-2.5 py-1.5 text-xs"
              onClick={() => setTargetOpen(!targetOpen)}
              disabled={generating}
              title="构建目标:切换后下次生成按新目标规范,预览与发布形态随之切换"
            >
              {project.platform === "mobile" ? "📱 移动" : "🌐 网页"} ▾
            </button>
            {targetOpen && (
              <div className="absolute left-0 top-full mt-1 card p-1.5 z-20 flex flex-col min-w-36">
                {(
                  [
                    ["web", "🌐 网页应用"],
                    ["mobile", "📱 移动应用"],
                  ] as const
                ).map(([pf, label]) => (
                  <button
                    key={pf}
                    className="text-left px-3 py-1.5 text-xs rounded-md hover:bg-accent-soft flex items-center gap-2"
                    onClick={() => {
                      setTargetOpen(false);
                      if (pf !== project.platform) patchProject({ platform: pf });
                    }}
                  >
                    <span className="flex-1">{label}</span>
                    {project.platform === pf && <span className="text-accent">✓</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        {versions.length > 0 && (
          <div className="relative">
            <button
              className="btn-ghost px-3 py-1.5 text-xs"
              onClick={() => setThemeOpen(!themeOpen)}
              disabled={generating || !project?.current_version_id}
              title="一键换肤:只改视觉,不改功能,产生可回滚的新版本"
            >
              🎨 {project?.theme ?? "换主题"}
            </button>
            {themeOpen && (
              <div className="absolute right-0 top-full mt-1 card p-1.5 z-20 flex flex-col min-w-32">
                <button
                  className="text-left px-3 py-1.5 text-xs rounded-md hover:bg-accent-soft text-muted"
                  onClick={() => switchTheme(null)}
                >
                  默认(清除主题)
                </button>
                {THEME_PRESETS.map((t) => (
                  <button
                    key={t}
                    className="text-left px-3 py-1.5 text-xs rounded-md hover:bg-accent-soft"
                    onClick={() => switchTheme(t)}
                  >
                    {t}
                  </button>
                ))}
              </div>
            )}
          </div>
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
            <div className="relative">
              <button
                className="btn-ghost px-3 py-1.5 text-xs"
                onClick={() => setDeployOpen(!deployOpen)}
                title="部署到本机或外部云"
              >
                ☁️ 部署
              </button>
              {deployOpen && (
                <div className="absolute right-0 top-full mt-1 card p-3 z-20 w-80 max-w-[90vw] flex flex-col gap-2.5 text-xs">
                  {project?.slug && (
                    <div className="border border-line rounded-lg p-2.5">
                      <b>专属域名</b>
                      {project.domain_name ? (
                        <div className="flex items-center gap-2 mt-1.5">
                          <a
                            href={`https://${project.domain_name}.quark-apps.lexarcai.com`}
                            target="_blank"
                            rel="noopener"
                            className="text-accent truncate hover:underline"
                          >
                            {project.domain_name}.quark-apps.lexarcai.com
                          </a>
                          <button
                            className="text-muted hover:text-bad ml-auto shrink-0"
                            onClick={() => patchProject({ domainName: null })}
                          >
                            释放
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 mt-1.5">
                          <input
                            className="input px-2 py-1.5 flex-1 min-w-0"
                            placeholder="myapp"
                            value={domainDraft}
                            maxLength={30}
                            onChange={(e) => setDomainDraft(e.target.value.toLowerCase())}
                          />
                          <span className="text-muted shrink-0">.quark-apps…</span>
                          <button
                            className="btn-primary px-2.5 py-1 shrink-0"
                            disabled={domainBusy || !domainDraft.trim()}
                            onClick={async () => {
                              setDomainBusy(true);
                              await patchProject({ domainName: domainDraft.trim() });
                              setDomainBusy(false);
                              setDomainDraft("");
                            }}
                          >
                            绑定
                          </button>
                        </div>
                      )}
                      <p className="text-muted mt-1">首次访问自动签发 HTTPS 证书,约需数秒</p>
                    </div>
                  )}
                  {(detail?.deployTargets ?? []).map((t) => (
                    <div key={t.id} className="border border-line rounded-lg p-2.5">
                      <div className="flex items-center gap-2">
                        <b>{t.name}</b>
                        {t.id === "local" && <span className="text-good">● 已部署(默认)</span>}
                        {t.status === "experimental" && <span className="text-amber">实验性</span>}
                        {t.status === "planned" && <span className="text-muted">规划中</span>}
                        {t.id !== "local" && t.status !== "planned" && (
                          <button
                            className="btn-primary px-3 py-1 ml-auto"
                            disabled={!!deployBusy || (t.id === "netlify" && !netlifyToken)}
                            onClick={() => runDeploy(t.id)}
                          >
                            {deployBusy === t.id ? "部署中…" : "部署"}
                          </button>
                        )}
                      </div>
                      <p className="text-muted mt-1">{t.note}</p>
                      {t.id === "netlify" && (
                        <input
                          className="input w-full px-2 py-1.5 mt-1.5"
                          type="password"
                          placeholder="Netlify Personal Access Token"
                          value={netlifyToken}
                          onChange={(e) => setNetlifyToken(e.target.value)}
                        />
                      )}
                    </div>
                  ))}
                  {(detail?.deployments ?? []).filter((d) => d.status === "live").length > 0 && (
                    <div>
                      <p className="font-mono text-[10px] tracking-widest text-muted mb-1.5">已部署</p>
                      {(detail?.deployments ?? [])
                        .filter((d) => d.status === "live")
                        .map((d) => (
                          <div key={d.id} className="flex items-center gap-2 py-1">
                            <span className="text-muted shrink-0">{d.provider}</span>
                            <a href={d.url} target="_blank" rel="noopener" className="text-accent truncate hover:underline">
                              {d.url.replace(/^https?:\/\//, "")}
                            </a>
                            <button className="text-muted hover:text-bad ml-auto shrink-0" onClick={() => undeploy(d.id)}>
                              下线
                            </button>
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              )}
            </div>
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
            {messages.map((m) => {
              if (m.meta === "pm") {
                let pm: { name?: string; summary?: string; goal?: string; stories?: string[]; acceptance?: string[] } | null = null;
                try {
                  pm = JSON.parse(m.content);
                } catch {
                  pm = null;
                }
                if (!pm) return null;
                return (
                  <div key={m.id} className="p-3 text-xs self-start max-w-[92%] border border-accent/40 bg-accent-soft rounded-lg">
                    <p className="font-mono text-[10px] tracking-widest text-accent mb-1.5">PM · 需求单</p>
                    {pm.goal && <p className="text-ink">🎯 {pm.goal}</p>}
                    {!!pm.stories?.length && (
                      <ul className="mt-1.5 space-y-1 text-muted">
                        {pm.stories.map((st) => (
                          <li key={st}>· {st}</li>
                        ))}
                      </ul>
                    )}
                    {!!pm.acceptance?.length && <p className="text-muted mt-1.5">验收:{pm.acceptance.join(" · ")}</p>}
                  </div>
                );
              }
              if (m.meta === "architect") {
                let bp = "";
                try {
                  bp = JSON.parse(m.content);
                } catch {
                  bp = m.content;
                }
                return (
                  <div key={m.id} className="p-3 text-xs self-start max-w-[92%] border border-line bg-bg-deep rounded-lg">
                    <p className="font-mono text-[10px] tracking-widest text-muted mb-1.5">ARCHITECT · 蓝图</p>
                    <p className="text-muted whitespace-pre-wrap leading-relaxed">{String(bp).slice(0, 600)}</p>
                  </div>
                );
              }
              if (m.meta === "research") {
                let brief: {
                  audience?: string;
                  patterns?: string[];
                  must_have?: string[];
                  nice_to_have?: string[];
                  risks?: string[];
                  references?: string[];
                } | null = null;
                try {
                  brief = JSON.parse(m.content);
                } catch {
                  brief = null;
                }
                if (!brief) return null;
                return (
                  <div key={m.id} className="p-3 text-xs self-start max-w-[92%] border border-amber/40 bg-amber/5 rounded-lg">
                    <p className="font-mono text-[10px] tracking-widest text-amber mb-1.5">RESEARCH BRIEF</p>
                    {brief.audience && <p className="text-ink">👥 {brief.audience}</p>}
                    {!!brief.patterns?.length && <p className="text-muted mt-1.5">借鉴模式:{brief.patterns.join(" · ")}</p>}
                    {!!brief.must_have?.length && <p className="text-muted mt-1">必备:{brief.must_have.join(" · ")}</p>}
                    {!!brief.nice_to_have?.length && <p className="text-muted mt-1">加分:{brief.nice_to_have.join(" · ")}</p>}
                    {!!brief.risks?.length && <p className="text-muted mt-1">风险:{brief.risks.join(" · ")}</p>}
                    {!!brief.references?.length && (
                      <p className="text-muted mt-1 break-all">引用:{brief.references.join(" ")}</p>
                    )}
                  </div>
                );
              }
              return (
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
              );
            })}

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
                  {(Object.keys(STAGE_LABELS) as StageName[])
                    .filter((name) => {
                      if (name === "researcher") return stages.researcher.state !== "idle" || research;
                      if (name === "pm" || name === "architect") return stages[name].state !== "idle" || team;
                      if (name === "planner") return !team || stages.planner.state !== "idle";
                      return true;
                    })
                    .map((name) => (
                    <div key={name} className="flex items-center gap-3">
                      <span
                        className={`stage-dot ${stages[name].state === "active" ? "active" : ""} ${stages[name].state === "done" ? "done" : ""}`}
                      />
                      <span className={`text-xs font-mono ${stages[name].state === "idle" ? "text-muted" : "text-ink"}`}>
                        {STAGE_LABELS[name]}
                        {stages[name].model && (
                          <span className="ml-1.5 px-1 py-0.5 rounded bg-accent-soft text-accent text-[10px]">
                            {stages[name].model}
                          </span>
                        )}
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
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <button
                className="btn-ghost px-2.5 py-1 text-xs"
                onClick={() => fileInputRef.current?.click()}
                disabled={generating}
                title="上传附件:文本/数据文件进入智能体上下文,图片作为资源内嵌进应用"
              >
                📎 附件
              </button>
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept=".txt,.md,.csv,.json,image/png,image/jpeg,image/webp,image/svg+xml"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) uploadFile(f);
                  e.target.value = "";
                }}
              />
              <button
                className={`px-2.5 py-1 text-xs rounded-lg border transition-colors ${research ? "border-amber/60 text-amber bg-amber/10" : "border-line text-muted hover:text-ink"}`}
                onClick={() => setResearch(!research)}
                disabled={generating}
                title="生成前由研究员智能体做领域分析;需求中的公开链接会被抓取纳入研究"
              >
                🔬 深度研究{research ? " ✓" : ""}
              </button>
              <button
                className={`px-2.5 py-1 text-xs rounded-lg border transition-colors ${team ? "border-accent/60 text-accent bg-accent-soft" : "border-line text-muted hover:text-ink"}`}
                onClick={() => setTeam(!team)}
                disabled={generating}
                title="智能体团队构建:PM 细化需求 → Architect 出架构蓝图 → Engineer 实现(迭代时由 Architect 出变更蓝图)"
              >
                👥 团队模式{team ? " ✓" : ""}
              </button>
              <div className="relative">
                <button
                  className="px-2.5 py-1 text-xs rounded-lg border border-line text-muted hover:text-ink transition-colors"
                  onClick={() => setConnOpen(!connOpen)}
                  disabled={generating}
                  title="连接器:允许应用调用平台代理的真实数据 API"
                >
                  🔌 连接器{(() => { try { const c = JSON.parse(project?.connectors ?? "[]"); return c.length ? ` ${c.length}` : ""; } catch { return ""; } })()}
                </button>
                {connOpen && (
                  <div className="absolute bottom-full mb-1 left-0 card p-2 z-20 flex flex-col gap-1 min-w-40">
                    {(
                      [
                        ["weather", "🌦 天气"],
                        ["rates", "💱 汇率"],
                        ["qr", "🔲 二维码"],
                      ] as const
                    ).map(([id, label]) => {
                      let enabled: string[] = [];
                      try { enabled = JSON.parse(project?.connectors ?? "[]"); } catch { enabled = []; }
                      const on = enabled.includes(id);
                      return (
                        <button
                          key={id}
                          className={`text-left px-2.5 py-1.5 text-xs rounded-md flex items-center gap-2 ${on ? "text-accent bg-accent-soft" : "text-muted hover:text-ink hover:bg-bg-deep"}`}
                          onClick={() => patchProject({ connectors: on ? enabled.filter((x) => x !== id) : [...enabled, id] })}
                        >
                          <span className="flex-1">{label}</span>
                          {on && <span>✓</span>}
                        </button>
                      );
                    })}
                    <p className="text-[10px] text-muted px-1 pt-1 border-t border-line">改动在下次生成时生效</p>
                  </div>
                )}
              </div>
              <div className="flex items-center rounded-lg border border-line overflow-hidden text-[11px]">
                {GEN_MODES.map(([m, label, desc]) => (
                  <button
                    key={m}
                    className={`px-2 py-1 transition-colors ${genMode === m ? "bg-accent-soft text-ink" : "text-muted hover:text-ink"}`}
                    onClick={() => setGenMode(m)}
                    disabled={generating}
                    title={desc}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {attachments.map((a) => (
                <span key={a.id} className="spec-chip px-2 py-1 text-[11px] flex items-center gap-1.5">
                  {a.kind === "image" ? "🖼" : "📄"} {a.filename}
                  <span className="text-muted">{Math.ceil(a.size / 1024)}KB</span>
                  {!generating && (
                    <button className="text-muted hover:text-bad" onClick={() => removeAttachment(a.id)} aria-label="删除附件">
                      ×
                    </button>
                  )}
                </span>
              ))}
            </div>
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
              <button
                className={`px-3 rounded-lg border text-sm transition-colors ${
                  speech.state === "listening"
                    ? "border-bad/50 text-bad animate-pulse"
                    : speech.state === "unsupported"
                      ? "border-line text-muted/40 cursor-not-allowed"
                      : "border-line text-muted hover:text-ink"
                }`}
                title={
                  speech.state === "unsupported"
                    ? "当前浏览器不支持语音输入,建议使用 Chrome"
                    : speech.error || (speech.state === "listening" ? "正在听,点击停止" : "语音输入(中文)")
                }
                onClick={() => speech.state !== "unsupported" && speech.toggle()}
                disabled={generating}
                aria-label="语音输入"
              >
                🎙
              </button>
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
                onClick={() => {
                  setTab(t);
                  if (t === "preview") setPreviewReady(false);
                }}
              >
                {t === "preview" ? "预览" : "代码"}
              </button>
            ))}
            {previewReady && tab === "code" && !generating && (
              <button
                className="px-3 py-1.5 text-xs rounded-lg text-good border border-good/40"
                onClick={() => {
                  setTab("preview");
                  setPreviewReady(false);
                }}
              >
                ✓ 新版本已生成 → 查看预览
              </button>
            )}
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
            onClick={() => {
              setMobilePane(pane);
              if (pane === "app") setPreviewReady(false);
            }}
          >
            {label}
            {pane === "app" && generating && <span className="text-amber ml-1 animate-pulse">●</span>}
            {pane === "app" && !generating && previewReady && mobilePane === "chat" && (
              <span className="text-good ml-1 animate-pulse">●</span>
            )}
          </button>
        ))}
      </nav>
    </div>
  );
}
