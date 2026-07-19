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

/** Small dismissible badge on published apps: attribution + the Remix entry point. */
function remixBadge(slug: string): string {
  const platform =
    process.env.PLATFORM_ORIGIN || (process.env.NODE_ENV === "production" ? "https://quark.lexarcai.com" : "");
  return `<script>(function(){function add(){var d=document.createElement('div');d.style.cssText='position:fixed;right:12px;bottom:12px;z-index:99999;display:flex;align-items:center;gap:6px;background:rgba(13,14,28,.92);color:#edebff;font:12px/1 -apple-system,sans-serif;padding:7px 10px;border-radius:99px;border:1px solid rgba(139,124,255,.35);box-shadow:0 2px 12px rgba(0,0,0,.25)';d.innerHTML='<a href="${platform}/remix/${slug}" target="_blank" rel="noopener" style="color:#edebff;text-decoration:none">\\u269b \\u7528 Quark \\u6784\\u5efa \\u00b7 <span style="color:#8b7cff">Remix</span></a><span style="cursor:pointer;color:#8d8aa8;padding:0 2px" aria-label="\\u5173\\u95ed">\\u00d7</span>';d.lastChild.onclick=function(){d.remove()};document.body.appendChild(d)}if(document.readyState==='loading'){document.addEventListener('DOMContentLoaded',add)}else{add()}})()</script>`;
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
  const helper = storageHelper(slug) + remixBadge(slug);
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
