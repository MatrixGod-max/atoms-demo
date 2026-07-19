"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export interface TemplateMeta {
  id: string;
  name: string;
  category: string;
  platform: "web" | "mobile";
  description: string;
}

export default function TemplateCard({ template }: { template: TemplateMeta }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function use() {
    if (busy) return;
    setBusy(true);
    setError("");
    const res = await fetch("/api/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ templateId: template.id }),
    });
    if (res.status === 401) {
      router.push(`/register?next=template&tpl=${encodeURIComponent(template.id)}`);
      return;
    }
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      router.push(`/project/${data.id}`);
    } else {
      setError(data.error || "创建失败");
      setBusy(false);
    }
  }

  return (
    <div className="card overflow-hidden flex flex-col">
      <div className="h-44 overflow-hidden bg-white relative shrink-0">
        <iframe
          src={`/api/templates/${template.id}/preview`}
          loading="lazy"
          sandbox="allow-scripts"
          className="w-[200%] h-[200%] origin-top-left scale-50 pointer-events-none border-0"
          title={template.name}
          tabIndex={-1}
        />
        <a
          href={`/api/templates/${template.id}/preview`}
          target="_blank"
          rel="noopener"
          className="absolute inset-0"
          aria-label={`预览 ${template.name}`}
        />
      </div>
      <div className="p-4 flex-1 flex flex-col gap-1.5">
        <p className="font-mono text-[10px] tracking-widest text-amber">{template.category}</p>
        <h3 className="font-semibold text-sm">
          <span className="mr-1">{template.platform === "mobile" ? "📱" : "🌐"}</span>
          {template.name}
        </h3>
        <p className="text-xs text-muted leading-relaxed line-clamp-2 flex-1">{template.description}</p>
        {error && <p className="text-bad text-xs">{error}</p>}
        <div className="flex items-center gap-2 mt-2">
          <button className="btn-primary px-4 py-1.5 text-xs" onClick={use} disabled={busy}>
            {busy ? "创建中…" : "使用模板 →"}
          </button>
          <a href={`/api/templates/${template.id}/preview`} target="_blank" rel="noopener" className="btn-ghost px-3 py-1.5 text-xs">
            预览
          </a>
        </div>
      </div>
    </div>
  );
}
