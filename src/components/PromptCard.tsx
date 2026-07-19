"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { useSpeech } from "@/lib/useSpeech";
import { THEME_PRESETS, encodeFileBase64, inferMime, launchProject, precheckFile } from "@/lib/launch";

const EXAMPLES = ["一个番茄钟专注应用", "极简记账本,支持分类统计", "习惯打卡日历", "团队站会抽签转盘"];

const REAL_CONNECTORS = [
  ["weather", "🌦 天气"],
  ["rates", "💱 汇率"],
  ["qr", "🔲 二维码"],
] as const;
const PLANNED_CONNECTORS = ["GitHub", "Figma", "Google Drive", "Notion", "Slack"];

function fmtSize(bytes: number) {
  return bytes >= 1024 ? `${(bytes / 1024).toFixed(bytes >= 10240 ? 0 : 1)}KB` : `${bytes}B`;
}

function Toggle({ on, onClick, disabled = false }: { on: boolean; onClick?: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      disabled={disabled}
      onClick={onClick}
      className={`relative w-9 h-5 rounded-full transition-colors flex-shrink-0 ${
        on ? "bg-ink" : "bg-line"
      } ${disabled ? "opacity-40 cursor-not-allowed" : ""}`}
    >
      <span
        className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
          on ? "translate-x-[18px]" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}

export default function PromptCard({ loggedIn, compact = false }: { loggedIn: boolean; compact?: boolean }) {
  const router = useRouter();
  const [prompt, setPrompt] = useState("");
  const [platform, setPlatform] = useState<"web" | "mobile">("web");
  const [research, setResearch] = useState(false);
  const [theme, setTheme] = useState<string | null>(null);
  const [connectors, setConnectors] = useState<string[]>([]);
  const [genMode, setGenMode] = useState<"fast" | "mixed" | "deep">("fast");
  const [modeOpen, setModeOpen] = useState(false);
  const speech = useSpeech((text) => setPrompt((v) => (v ? `${v}${text}` : text)));
  const [teamMode, setTeamMode] = useState(false); // visual only
  const [files, setFiles] = useState<File[]>([]);
  const [plusOpen, setPlusOpen] = useState(false);
  const [connectorsOpen, setConnectorsOpen] = useState(false);
  const [themeOpen, setThemeOpen] = useState(false);
  const [buildOpen, setBuildOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  function closeMenus() {
    setPlusOpen(false);
    setConnectorsOpen(false);
    setThemeOpen(false);
    setBuildOpen(false);
  }

  function addFiles(list: FileList | null) {
    if (!list) return;
    setError("");
    const next = [...files];
    for (const f of Array.from(list)) {
      const bad = precheckFile(f, next.length);
      if (bad) {
        setError(`${f.name}:${bad}`);
        break;
      }
      next.push(f);
    }
    setFiles(next);
  }

  async function submit() {
    const trimmed = prompt.trim();
    if (!trimmed || busy) return;
    setError("");
    closeMenus();
    if (!loggedIn) {
      sessionStorage.setItem("quark_boot", JSON.stringify({ prompt: trimmed, platform, research, team: teamMode, theme, mode: genMode, connectors }));
      router.push("/register?next=launch");
      return;
    }
    setBusy(true);
    const result = await launchProject(trimmed, platform, { research, team: teamMode, theme, mode: genMode, connectors });
    if ("error" in result) {
      setError(result.error);
      setBusy(false);
      return;
    }
    // Upload attachments before entering the Builder so the first generation sees them.
    const failed: string[] = [];
    for (const f of files) {
      try {
        const res = await fetch(`/api/projects/${result.id}/attachments`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ filename: f.name, mime: inferMime(f), dataBase64: await encodeFileBase64(f) }),
        });
        if (!res.ok) failed.push(f.name);
      } catch {
        failed.push(f.name);
      }
    }
    if (failed.length) console.warn(`附件上传失败:${failed.join("、")}`);
    router.push(`/project/${result.id}`);
  }

  const menuItem = "w-full flex items-center gap-2.5 px-3 py-2.5 text-sm rounded-lg hover:bg-bg-deep transition-colors";

  return (
    <div className="w-full relative">
      <div className="card rounded-2xl p-4 relative z-20">
        <textarea
          className="w-full resize-none bg-transparent outline-none text-[15px] placeholder:text-muted"
          rows={compact ? 2 : 3}
          placeholder="描述你想要创造的应用,例如:一个支持分类和统计的极简记账本…"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit();
          }}
        />

        <div className="flex items-center justify-between gap-2 mt-2">
          {/* left cluster: plus menu + theme chip */}
          <div className="flex items-center gap-2">
            <div className="relative">
              <button
                type="button"
                aria-label={plusOpen ? "关闭工具菜单" : "打开工具菜单"}
                className="w-9 h-9 rounded-full border border-line flex items-center justify-center text-muted hover:text-ink hover:bg-bg-deep transition-colors"
                onClick={() => {
                  setThemeOpen(false);
                  setBuildOpen(false);
                  setPlusOpen(!plusOpen);
                }}
              >
                <span className={`text-lg leading-none transition-transform ${plusOpen ? "rotate-45" : ""}`}>+</span>
              </button>

              {plusOpen && (
                <div className="absolute left-0 top-11 w-60 card rounded-xl p-1.5 shadow-lg z-30">
                  <div className={menuItem}>
                    <span className="text-base">👥</span>
                    <span className="flex-1 text-left">团队模式</span>
                    <Toggle on={teamMode} onClick={() => setTeamMode(!teamMode)} />
                  </div>
                  <button
                    type="button"
                    className={`${menuItem} ${!loggedIn ? "opacity-40 cursor-not-allowed" : ""}`}
                    title={loggedIn ? "文本/数据文件进入智能体上下文,图片内嵌进应用" : "登录后可添加附件"}
                    onClick={() => loggedIn && fileInputRef.current?.click()}
                  >
                    <span className="text-base">📎</span>
                    <span className="flex-1 text-left">附件</span>
                    <span className="text-muted">›</span>
                  </button>
                  <button
                    type="button"
                    className={menuItem}
                    onClick={() => setConnectorsOpen(!connectorsOpen)}
                  >
                    <span className="text-base">🔌</span>
                    <span className="flex-1 text-left">连接器</span>
                    <span className={`text-muted transition-transform ${connectorsOpen ? "rotate-90" : ""}`}>›</span>
                  </button>
                  {connectorsOpen && (
                    <div className="px-3 pb-2">
                      <div className="flex flex-wrap gap-1.5">
                        {REAL_CONNECTORS.map(([id, label]) => (
                          <button
                            key={id}
                            type="button"
                            className={`px-2 py-1 text-[11px] rounded-md border transition-colors ${
                              connectors.includes(id) ? "border-accent text-accent bg-accent-soft" : "border-line text-muted hover:text-ink"
                            }`}
                            onClick={() =>
                              setConnectors((cs) => (cs.includes(id) ? cs.filter((x) => x !== id) : [...cs, id]))
                            }
                          >
                            {label}
                            {connectors.includes(id) ? " ✓" : ""}
                          </button>
                        ))}
                      </div>
                      <div className="flex flex-wrap gap-1.5 mt-1.5">
                        {PLANNED_CONNECTORS.map((c) => (
                          <span key={c} className="px-2 py-1 text-[11px] rounded-md border border-line text-muted/50" title="规划中">
                            {c}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="border-t border-line my-1" />
                  <div className={menuItem}>
                    <span className="text-base">🔬</span>
                    <span className="flex-1 text-left">深度研究</span>
                    <Toggle on={research} onClick={() => setResearch(!research)} />
                  </div>
                  <div className={`${menuItem} opacity-40 cursor-not-allowed`} title="即将推出">
                    <span className="text-base">🏆</span>
                    <span className="flex-1 text-left">竞赛模式</span>
                    <span className="text-muted">›</span>
                  </div>
                </div>
              )}
            </div>

            <div className="relative">
              <button
                type="button"
                className={`flex items-center gap-1.5 px-3 h-9 rounded-full border text-sm transition-colors ${
                  theme ? "border-ink/30 bg-bg-deep text-ink" : "border-line text-muted hover:text-ink hover:bg-bg-deep"
                }`}
                onClick={() => {
                  setPlusOpen(false);
                  setBuildOpen(false);
                  setThemeOpen(!themeOpen);
                }}
              >
                <span>🎨</span>
                <span>{theme ?? "主题"}</span>
                <span className="text-[10px] text-muted">▾</span>
              </button>
              {themeOpen && (
                <div className="absolute left-0 top-11 w-40 card rounded-xl p-1.5 shadow-lg z-30">
                  <button type="button" className={menuItem} onClick={() => { setTheme(null); setThemeOpen(false); }}>
                    <span className="flex-1 text-left">默认</span>
                    {!theme && <span className="text-accent">✓</span>}
                  </button>
                  {THEME_PRESETS.map((t) => (
                    <button key={t} type="button" className={menuItem} onClick={() => { setTheme(t); setThemeOpen(false); }}>
                      <span className="flex-1 text-left">{t}</span>
                      {theme === t && <span className="text-accent">✓</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* right cluster: mode + build target + voice + submit */}
          <div className="flex items-center gap-2">
            <div className="relative">
              <button
                type="button"
                className="flex items-center gap-1.5 px-3 h-9 rounded-lg border border-line text-sm text-ink hover:bg-bg-deep transition-colors"
                title="生成模式:快速(全V3)/ 混合(R1思考+V3编码)/ 深度(全R1)"
                onClick={() => {
                  setPlusOpen(false);
                  setThemeOpen(false);
                  setBuildOpen(false);
                  setModeOpen(!modeOpen);
                }}
              >
                <span>{genMode === "fast" ? "⚡ 快速" : genMode === "mixed" ? "🧠 混合" : "🐢 深度"}</span>
                <span className="text-[10px] text-muted">▾</span>
              </button>
              {modeOpen && (
                <div className="absolute right-0 top-11 w-52 card rounded-xl p-1.5 shadow-lg z-30">
                  {(
                    [
                      ["fast", "⚡ 快速", "全阶段 V3,最快"],
                      ["mixed", "🧠 混合", "R1 思考 + V3 编码"],
                      ["deep", "🐢 深度", "全阶段 R1,最强最慢"],
                    ] as const
                  ).map(([m, label, desc]) => (
                    <button key={m} type="button" className={menuItem} onClick={() => { setGenMode(m); setModeOpen(false); }}>
                      <span className="flex-1 text-left">{label}<span className="block text-[11px] text-muted">{desc}</span></span>
                      {genMode === m && <span className="text-accent">✓</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="relative">
              <button
                type="button"
                className="flex items-center gap-1.5 px-3 h-9 rounded-lg border border-line text-sm text-ink hover:bg-bg-deep transition-colors"
                onClick={() => {
                  setPlusOpen(false);
                  setThemeOpen(false);
                  setModeOpen(false);
                  setBuildOpen(!buildOpen);
                }}
              >
                <span>{platform === "web" ? "构建" : "📱 构建"}</span>
                <span className="text-[10px] text-muted">▾</span>
              </button>
              {buildOpen && (
                <div className="absolute right-0 top-11 w-44 card rounded-xl p-1.5 shadow-lg z-30">
                  {(
                    [
                      ["web", "🌐 网页应用"],
                      ["mobile", "📱 移动应用"],
                    ] as const
                  ).map(([p, label]) => (
                    <button key={p} type="button" className={menuItem} onClick={() => { setPlatform(p); setBuildOpen(false); }}>
                      <span className="flex-1 text-left">{label}</span>
                      {platform === p && <span className="text-accent">✓</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button
              type="button"
              aria-label={speech.state === "listening" ? "停止语音输入" : "语音输入"}
              title={
                speech.state === "unsupported"
                  ? "当前浏览器不支持语音输入,建议使用 Chrome"
                  : speech.error || (speech.state === "listening" ? "正在听,点击停止" : "语音输入(中文)")
              }
              className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors ${
                speech.state === "listening"
                  ? "bg-bad/10 text-bad animate-pulse"
                  : speech.state === "unsupported"
                    ? "text-muted/40 cursor-not-allowed"
                    : "text-muted hover:text-ink hover:bg-bg-deep"
              }`}
              onClick={() => speech.state !== "unsupported" && speech.toggle()}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
                <rect x="1" y="6" width="2" height="4" rx="1" />
                <rect x="5" y="3" width="2" height="10" rx="1" />
                <rect x="9" y="5" width="2" height="6" rx="1" />
                <rect x="13" y="7" width="2" height="2" rx="1" />
              </svg>
            </button>
            <button
              type="button"
              aria-label="开始构建"
              className="w-9 h-9 rounded-full bg-ink text-white flex items-center justify-center hover:brightness-150 transition-all disabled:opacity-35 disabled:cursor-not-allowed"
              onClick={submit}
              disabled={busy || !prompt.trim()}
            >
              {busy ? (
                <span className="text-xs">…</span>
              ) : (
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M7 12V2M3 6l4-4 4 4" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".txt,.md,.csv,.json,image/png,image/jpeg,image/webp,image/svg+xml"
        className="hidden"
        onChange={(e) => {
          addFiles(e.target.files);
          e.target.value = "";
        }}
      />

      {files.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-2.5">
          {files.map((f, i) => (
            <span key={`${f.name}_${i}`} className="flex items-center gap-1.5 pl-2 pr-1.5 py-1 rounded-lg bg-bg-deep border border-line text-xs">
              <span>{f.type.startsWith("image/") ? "🖼" : "📄"}</span>
              <span className="max-w-[160px] truncate">{f.name}</span>
              <span className="text-muted">{fmtSize(f.size)}</span>
              <button
                type="button"
                aria-label={`移除 ${f.name}`}
                className="text-muted hover:text-bad px-0.5"
                onClick={() => setFiles(files.filter((_, j) => j !== i))}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      {(research || theme) && (
        <div className="flex flex-wrap gap-2 mt-2.5 text-[11px] text-muted">
          {research && <span className="px-2 py-1 rounded-md bg-accent-soft text-accent">🔬 深度研究已开启</span>}
          {theme && <span className="px-2 py-1 rounded-md bg-accent-soft text-accent">🎨 主题:{theme}</span>}
        </div>
      )}

      {error && <p className="text-bad text-sm mt-2">{error}</p>}

      {!compact && (
        <div className="flex flex-wrap gap-2 mt-4 justify-center">
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              type="button"
              className="btn-ghost px-3 py-1.5 text-xs text-muted hover:text-ink"
              onClick={() => setPrompt(ex)}
            >
              {ex}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
