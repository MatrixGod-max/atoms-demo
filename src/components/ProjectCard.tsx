"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export interface ProjectSummary {
  id: string;
  name: string;
  slug: string | null;
  published_version_id: string | null;
  updated_at: number;
  version_count: number;
}

export default function ProjectCard({ project }: { project: ProjectSummary }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const published = !!project.published_version_id && !!project.slug;

  async function remove(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (busy || !confirm(`删除项目「${project.name}」?此操作不可恢复。`)) return;
    setBusy(true);
    await fetch(`/api/projects/${project.id}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <Link href={`/project/${project.id}`} className="card p-5 block hover:border-accent/40 transition-colors group">
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-semibold text-sm leading-snug line-clamp-2">{project.name}</h3>
        <button
          className="text-muted hover:text-bad text-xs opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
          onClick={remove}
          disabled={busy}
          aria-label="删除项目"
        >
          删除
        </button>
      </div>
      <div className="flex items-center gap-3 mt-4 text-xs text-muted font-mono">
        <span>v{project.version_count}</span>
        <span>{new Date(project.updated_at).toLocaleDateString("zh-CN")}</span>
        {published && (
          <span
            className="text-good cursor-pointer hover:underline"
            onClick={(e) => {
              e.preventDefault();
              window.open(`/p/${project.slug}`, "_blank");
            }}
          >
            ● 已发布
          </span>
        )}
      </div>
    </Link>
  );
}
