"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import AppCard from "@/components/AppCard";
import type { GalleryApp } from "@/lib/gallery";

/**
 * 发现 tab with 聚变模式: toggle selection across app cards, pick exactly two
 * published apps and fuse them into a brand-new project.
 */
export default function DiscoverGrid({
  apps,
  urls,
  preselect,
}: {
  apps: GalleryApp[];
  urls: Record<string, string>;
  preselect?: string;
}) {
  const router = useRouter();
  const validPreselect = preselect && apps.some((a) => a.slug === preselect) ? [preselect] : [];
  const [fuseMode, setFuseMode] = useState(validPreselect.length > 0);
  const [selected, setSelected] = useState<string[]>(validPreselect);

  function toggle(slug: string) {
    setSelected((sel) =>
      sel.includes(slug) ? sel.filter((s) => s !== slug) : sel.length >= 2 ? [sel[1], slug] : [...sel, slug]
    );
  }

  return (
    <>
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <button
          className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
            fuseMode ? "border-accent/60 text-accent bg-accent-soft" : "border-line text-muted hover:text-ink"
          }`}
          onClick={() => {
            setFuseMode(!fuseMode);
            if (fuseMode) setSelected([]);
          }}
          title="聚变:选择两个已发布应用,智能体把它们合并为一个全新应用"
        >
          ⚛ 聚变模式{fuseMode ? " ✓" : ""}
        </button>
        {fuseMode && (
          <p className="text-xs text-muted">
            选择两个应用进行聚变(已选 {selected.length}/2)—— Remix 是复刻一个,聚变是合并两个
          </p>
        )}
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {apps.map((app) =>
          fuseMode ? (
            <button
              key={app.slug}
              className={`text-left rounded-2xl transition-shadow ${
                selected.includes(app.slug) ? "ring-2 ring-accent shadow-lg" : "hover:ring-1 hover:ring-line"
              }`}
              onClick={() => toggle(app.slug)}
              aria-pressed={selected.includes(app.slug)}
            >
              <div className="pointer-events-none relative">
                <AppCard app={app} url={urls[app.slug]} />
                {selected.includes(app.slug) && (
                  <span className="absolute top-2 right-2 w-6 h-6 rounded-full bg-accent text-white text-xs flex items-center justify-center">
                    {selected.indexOf(app.slug) + 1}
                  </span>
                )}
              </div>
            </button>
          ) : (
            <AppCard key={app.slug} app={app} url={urls[app.slug]} />
          )
        )}
      </div>
      {fuseMode && selected.length === 2 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-30 card px-4 py-3 flex items-center gap-3 shadow-xl">
          <span className="text-sm">
            ⚛ {apps.find((a) => a.slug === selected[0])?.name} × {apps.find((a) => a.slug === selected[1])?.name}
          </span>
          <button
            className="btn-primary px-4 py-1.5 text-sm"
            onClick={() => router.push(`/fuse?a=${encodeURIComponent(selected[0])}&b=${encodeURIComponent(selected[1])}`)}
          >
            开始聚变(+2 积分)
          </button>
        </div>
      )}
      {apps.length === 0 && (
        <div className="card p-10 text-center text-muted text-sm">
          还没有发布的作品。
          <Link href="/" className="text-accent hover:underline">
            去生成第一个应用
          </Link>
        </div>
      )}
    </>
  );
}
