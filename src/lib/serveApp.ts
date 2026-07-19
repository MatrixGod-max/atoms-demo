/** Shared serving pipeline for published apps: helper/badge injection + response. */
import { connectorsHelper, parseConnectors } from "./connectors";

/**
 * ~600B runtime injected into every published app: window.quark.storage —
 * server-backed KV shared by all visitors of the app, localStorage fallback.
 * Keyed by project, so data stays continuous across artifact snapshots.
 */
function storageHelper(slug: string, apiBase = ""): string {
  return `<script>(function(){var s=${JSON.stringify(slug)};var b=${JSON.stringify(apiBase)}+'/api/apps/'+s+'/kv/';window.quark={slug:s,storage:{
get:async function(k){try{var r=await fetch(b+encodeURIComponent(k));if(!r.ok)return null;return (await r.json()).v}catch(e){try{return localStorage.getItem('qk_'+s+'_'+k)}catch(_){return null}}},
set:async function(k,v){try{var r=await fetch(b+encodeURIComponent(k),{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify({v:String(v)})});if(r.ok)return true;throw 0}catch(e){try{localStorage.setItem('qk_'+s+'_'+k,String(v));return true}catch(_){return false}}}}};})()</script>`;
}

/** Small dismissible badge on published apps: attribution + the Remix entry point. */
function remixBadge(slug: string): string {
  const platform =
    process.env.PLATFORM_ORIGIN || (process.env.NODE_ENV === "production" ? "https://quark.lexarcai.com" : "");
  return `<script>(function(){function add(){var d=document.createElement('div');d.style.cssText='position:fixed;right:12px;bottom:12px;z-index:99999;display:flex;align-items:center;gap:6px;background:rgba(13,14,28,.92);color:#edebff;font:12px/1 -apple-system,sans-serif;padding:7px 10px;border-radius:99px;border:1px solid rgba(139,124,255,.35);box-shadow:0 2px 12px rgba(0,0,0,.25)';d.innerHTML='<a href="${platform}/remix/${slug}" target="_blank" rel="noopener" style="color:#edebff;text-decoration:none">\\u2600 \\u7528 Fusion \\u6784\\u5efa \\u00b7 <span style="color:#8b7cff">Remix</span></a><span style="cursor:pointer;color:#8d8aa8;padding:0 2px" aria-label="\\u5173\\u95ed">\\u00d7</span>';d.lastChild.onclick=function(){d.remove()};document.body.appendChild(d)}if(document.readyState==='loading'){document.addEventListener('DOMContentLoaded',add)}else{add()}})()</script>`;
}

/**
 * Mobile artifacts are installable PWAs: manifest link + missing mobile meta +
 * service-worker registration (latest only — snapshots stay plain documents).
 */
function pwaHelper(slug: string, html: string, snapshot: boolean): string {
  let extra = `<link rel="manifest" href="/api/apps/${slug}/manifest.webmanifest">`;
  if (!/name="theme-color"/i.test(html)) extra += `<meta name="theme-color" content="#0d0e1c">`;
  if (!/apple-mobile-web-app-capable/i.test(html)) {
    extra += `<meta name="apple-mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">`;
  }
  if (!snapshot) {
    // sw path/scope derive from the page path, so both the apps origin (/{slug}) and dev (/p/{slug}) work.
    extra += `<script>if('serviceWorker' in navigator){var p=location.pathname.replace(/\\/$/,'');navigator.serviceWorker.register(p+'/sw.js',{scope:p}).catch(function(){})}</script>`;
  }
  return extra;
}

export interface ServeOptions {
  platform?: "web" | "mobile";
  snapshot?: boolean;
  /** raw JSON column value; parsed defensively */
  connectors?: string | null;
}

function buildAppHtml(html: string, slug: string, opts: ServeOptions, apiBase = ""): string {
  let helper = storageHelper(slug, apiBase) + remixBadge(slug) + connectorsHelper(parseConnectors(opts.connectors), apiBase);
  // PWA surfaces (manifest/SW) are same-origin routes; skip them off-origin.
  if (opts.platform === "mobile" && !apiBase) helper += pwaHelper(slug, html, !!opts.snapshot);
  return /<head[^>]*>/i.test(html) ? html.replace(/<head([^>]*)>/i, `<head$1>${helper}`) : helper + html;
}

export function serveAppHtml(html: string, slug: string, opts: ServeOptions = {}): Response {
  return new Response(buildAppHtml(html, slug, opts), {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-cache",
    },
  });
}

/** Self-contained HTML for off-origin deploys (S3/Netlify): KV calls go to the apps origin via CORS. */
export function exportAppHtml(html: string, slug: string, opts: ServeOptions = {}): string {
  const apiBase =
    process.env.NEXT_PUBLIC_APPS_ORIGIN ||
    process.env.PLATFORM_ORIGIN ||
    (process.env.NODE_ENV === "production" ? "https://quark-apps.lexarcai.com" : "http://localhost:3000");
  return buildAppHtml(html, slug, opts, apiBase);
}

export function notFoundApp(): Response {
  return new Response("<h1>404</h1><p>这个应用不存在或已下线。</p>", {
    status: 404,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}
