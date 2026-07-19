"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export interface ArtifactRow {
  seq: number;
  notes: string | null;
  created_at: number;
  version_id: string;
  version_num: number;
}

export default function ArtifactTimeline({
  slug,
  projectId,
  artifacts,
  latestVersionId,
  isOwner,
}: {
  slug: string;
  projectId: string;
  artifacts: ArtifactRow[];
  latestVersionId: string;
  isOwner: boolean;
}) {
  const router = useRouter();
  const [busySeq, setBusySeq] = useState<number | null>(null);
  const [error, setError] = useState("");
  const appsOrigin = process.env.NEXT_PUBLIC_APPS_ORIGIN;
  const snapshotUrl = (seq: number) => (appsOrigin ? `${appsOrigin}/${slug}/v/${seq}` : `/p/${slug}/v/${seq}`);

  async function setLatest(seq: number) {
    setBusySeq(seq);
    setError("");
    const res = await fetch(`/api/projects/${projectId}/publish`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "set_latest", artifactSeq: seq }),
    });
    if (res.ok) router.refresh();
    else {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "操作失败");
    }
    setBusySeq(null);
  }

  return (
    <div className="flex flex-col gap-3">
      {error && <p className="text-bad text-sm">{error}</p>}
      {artifacts.map((a) => {
        const isLatest = a.version_id === latestVersionId;
        return (
          <div key={a.seq} className={`card p-4 flex items-center gap-4 ${isLatest ? "border-accent/50" : ""}`}>
            <span className="font-mono text-sm text-accent shrink-0">#{a.seq}</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm truncate">
                {a.notes || `版本 v${a.version_num}`}
                {isLatest && <span className="text-good text-xs ml-2">● 线上版本</span>}
              </p>
              <p className="font-mono text-[11px] text-muted mt-1">
                v{a.version_num} · {new Date(a.created_at).toLocaleString("zh-CN")}
              </p>
            </div>
            <a href={snapshotUrl(a.seq)} target="_blank" rel="noopener" className="btn-ghost px-3 py-1.5 text-xs shrink-0">
              打开快照
            </a>
            <Link href={`/remix/${slug}`} className="btn-ghost px-3 py-1.5 text-xs text-accent shrink-0 max-sm:hidden">
              Remix
            </Link>
            {isOwner && !isLatest && (
              <button
                className="btn-ghost px-3 py-1.5 text-xs shrink-0"
                onClick={() => setLatest(a.seq)}
                disabled={busySeq !== null}
              >
                {busySeq === a.seq ? "切换中…" : "设为线上版本"}
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
