import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Per-app service worker: offline-capable navigation, cache invalidated on each new artifact. */
export async function GET(_req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const row = db
    .prepare(
      `SELECT COALESCE(a.seq, 0) AS seq FROM projects p
       LEFT JOIN artifacts a ON a.project_id = p.id AND a.version_id = p.published_version_id
       WHERE p.slug = ? AND p.published_version_id IS NOT NULL`
    )
    .get(slug) as { seq: number } | undefined;
  if (!row) return new Response("// gone", { status: 404, headers: { "content-type": "application/javascript" } });

  const js = `const CACHE='quark-${slug}-a${row.seq}';
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',e=>e.waitUntil(
  caches.keys()
    .then(ks=>Promise.all(ks.filter(k=>k.startsWith('quark-${slug}-')&&k!==CACHE).map(k=>caches.delete(k))))
    .then(()=>self.clients.claim())
));
self.addEventListener('fetch',e=>{
  if(e.request.mode!=='navigate')return;
  e.respondWith(
    fetch(e.request).then(r=>{
      const c=r.clone();
      caches.open(CACHE).then(x=>x.put(e.request,c));
      return r;
    }).catch(()=>caches.match(e.request).then(m=>m||Response.error()))
  );
});`;
  return new Response(js, {
    headers: {
      "content-type": "application/javascript; charset=utf-8",
      "service-worker-allowed": "/",
      "cache-control": "no-cache",
    },
  });
}
