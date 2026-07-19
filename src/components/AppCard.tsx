import Link from "next/link";
import type { GalleryApp } from "@/lib/gallery";

export default function AppCard({ app, url }: { app: GalleryApp; url: string }) {
  return (
    <div className="card overflow-hidden flex flex-col">
      <div className="h-44 overflow-hidden bg-white relative shrink-0">
        <iframe
          src={url}
          loading="lazy"
          sandbox="allow-scripts"
          className="w-[200%] h-[200%] origin-top-left scale-50 pointer-events-none border-0"
          title={app.name}
          tabIndex={-1}
        />
        <a href={url} target="_blank" rel="noopener" className="absolute inset-0" aria-label={`打开 ${app.name}`} />
      </div>
      <div className="p-4 flex-1 flex flex-col gap-1.5">
        <h3 className="font-semibold text-sm">{app.name}</h3>
        {app.summary && <p className="text-xs text-muted leading-relaxed line-clamp-2 flex-1">{app.summary}</p>}
        <div className="flex items-center gap-2 mt-2">
          <a href={url} target="_blank" rel="noopener" className="btn-ghost px-3 py-1.5 text-xs">
            打开
          </a>
          <Link href={`/remix/${app.slug}`} className="btn-ghost px-3 py-1.5 text-xs text-accent">
            ⚛ Remix
          </Link>
          <span className="ml-auto font-mono text-[10px] text-muted">
            {new Date(app.updated_at).toLocaleDateString("zh-CN")}
          </span>
        </div>
      </div>
    </div>
  );
}
