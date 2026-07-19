import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * ~600B runtime injected into every published app: window.quark.storage —
 * server-backed KV shared by all visitors of the app, localStorage fallback.
 */
function storageHelper(slug: string): string {
  return `<script>(function(){var s=${JSON.stringify(slug)};var b='/api/apps/'+s+'/kv/';window.quark={slug:s,storage:{
get:async function(k){try{var r=await fetch(b+encodeURIComponent(k));if(!r.ok)return null;return (await r.json()).v}catch(e){try{return localStorage.getItem('qk_'+s+'_'+k)}catch(_){return null}}},
set:async function(k,v){try{var r=await fetch(b+encodeURIComponent(k),{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify({v:String(v)})});if(r.ok)return true;throw 0}catch(e){try{localStorage.setItem('qk_'+s+'_'+k,String(v));return true}catch(_){return false}}}}};})()</script>`;
}

export async function GET(_req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const row = db
    .prepare(
      `SELECT v.html FROM projects p JOIN app_versions v ON v.id = p.published_version_id
       WHERE p.slug = ? AND p.published_version_id IS NOT NULL`
    )
    .get(slug) as { html: string } | undefined;

  if (!row) {
    return new Response("<h1>404</h1><p>这个应用不存在或已下线。</p>", {
      status: 404,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
  const helper = storageHelper(slug);
  const html = /<head[^>]*>/i.test(row.html)
    ? row.html.replace(/<head([^>]*)>/i, `<head$1>${helper}`)
    : helper + row.html;
  return new Response(html, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-cache",
    },
  });
}
