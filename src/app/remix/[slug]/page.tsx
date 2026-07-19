"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

export default function RemixPage() {
  const { slug } = useParams<{ slug: string }>();
  const router = useRouter();
  const [error, setError] = useState("");
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current || !slug) return;
    startedRef.current = true;
    (async () => {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ remixSlug: slug }),
      });
      if (res.status === 401) {
        router.replace(`/register?next=remix&slug=${encodeURIComponent(slug)}`);
        return;
      }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Remix 失败");
        return;
      }
      router.replace(`/project/${data.id}`);
    })();
  }, [slug, router]);

  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-4 px-6 text-center">
      <span className="text-4xl">⚛</span>
      {error ? (
        <>
          <p className="text-bad text-sm">{error}</p>
          <Link href="/resources" className="btn-ghost px-4 py-2 text-sm">
            返回资源中心
          </Link>
        </>
      ) : (
        <p className="text-muted text-sm">正在 Remix 这个应用到你的工作台…</p>
      )}
    </div>
  );
}
