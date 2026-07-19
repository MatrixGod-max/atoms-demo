"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

export default function FuseClient({ a, b }: { a: string; b: string }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current || !a || !b) return;
    startedRef.current = true;
    (async () => {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ fuseSlugs: [a, b] }),
      });
      if (res.status === 401) {
        router.replace(`/register?next=fuse&a=${encodeURIComponent(a)}&b=${encodeURIComponent(b)}`);
        return;
      }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "聚变失败");
        return;
      }
      const [nameA, nameB] = (data.sources as string[] | undefined) ?? [a, b];
      sessionStorage.setItem(
        `quark_pending_${data.id}`,
        JSON.stringify({
          prompt: `聚变合成:把「${nameA}」与「${nameB}」融合为一个全新应用 —— 保留两者的核心能力,统一信息架构、状态与视觉体验。`,
        })
      );
      router.replace(`/project/${data.id}`);
    })();
  }, [a, b, router]);

  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-4 px-6 text-center min-h-dvh">
      <span className="text-4xl">⚛</span>
      {error || !a || !b ? (
        <>
          <p className="text-bad text-sm">{error || "缺少聚变源参数"}</p>
          <Link href="/resources" className="btn-ghost px-4 py-2 text-sm">
            返回资源中心
          </Link>
        </>
      ) : (
        <p className="text-muted text-sm">正在聚变两个应用到你的工作台…</p>
      )}
    </div>
  );
}
