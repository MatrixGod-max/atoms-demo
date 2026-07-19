"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const EXAMPLES = ["一个番茄钟专注应用", "极简记账本,支持分类统计", "习惯打卡日历", "团队站会抽签转盘"];

/** Creates a project from a prompt and jumps into the builder. */
export async function launchProject(prompt: string, platform: "web" | "mobile" = "web"): Promise<string | null> {
  const res = await fetch("/api/projects", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ prompt, platform }),
  });
  if (!res.ok) return null;
  const { id } = await res.json();
  sessionStorage.setItem(`quark_pending_${id}`, prompt);
  return id;
}

export default function PromptLauncher({
  loggedIn,
  compact = false,
}: {
  loggedIn: boolean;
  compact?: boolean;
}) {
  const router = useRouter();
  const [prompt, setPrompt] = useState("");
  const [platform, setPlatform] = useState<"web" | "mobile">("web");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    const trimmed = prompt.trim();
    if (!trimmed || busy) return;
    setError("");
    if (!loggedIn) {
      sessionStorage.setItem("quark_boot", JSON.stringify({ prompt: trimmed, platform }));
      router.push("/register?next=launch");
      return;
    }
    setBusy(true);
    const id = await launchProject(trimmed, platform);
    if (id) {
      router.push(`/project/${id}`);
    } else {
      setError("创建失败,请重试");
      setBusy(false);
    }
  }

  return (
    <div className="w-full">
      <div className="card p-3 flex flex-col gap-2 relative z-10">
        <textarea
          className="input p-3 resize-none text-[15px]"
          rows={compact ? 2 : 3}
          placeholder="描述你想要的应用,例如:一个支持分类和统计的极简记账本…"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit();
          }}
        />
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center rounded-lg border border-line overflow-hidden text-xs">
            {(
              [
                ["web", "🌐 网页应用"],
                ["mobile", "📱 移动应用"],
              ] as const
            ).map(([p, label]) => (
              <button
                key={p}
                type="button"
                className={`px-3 py-1.5 transition-colors ${platform === p ? "bg-accent-soft text-ink" : "text-muted hover:text-ink"}`}
                onClick={() => setPlatform(p)}
              >
                {label}
              </button>
            ))}
          </div>
          <button className="btn-primary px-5 py-2 text-sm" onClick={submit} disabled={busy || !prompt.trim()}>
            {busy ? "创建中…" : "开始构建 →"}
          </button>
        </div>
      </div>
      {error && <p className="text-bad text-sm mt-2">{error}</p>}
      {!compact && (
        <div className="flex flex-wrap gap-2 mt-4 justify-center">
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
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
