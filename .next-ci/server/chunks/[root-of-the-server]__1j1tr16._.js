module.exports=[66680,(e,t,r)=>{t.exports=e.x("node:crypto",()=>require("node:crypto"))},2157,(e,t,r)=>{t.exports=e.x("node:fs",()=>require("node:fs"))},50227,(e,t,r)=>{t.exports=e.x("node:path",()=>require("node:path"))},18622,(e,t,r)=>{t.exports=e.x("next/dist/compiled/next-server/app-page-turbo.runtime.prod.js",()=>require("next/dist/compiled/next-server/app-page-turbo.runtime.prod.js"))},56704,(e,t,r)=>{t.exports=e.x("next/dist/server/app-render/work-async-storage.external.js",()=>require("next/dist/server/app-render/work-async-storage.external.js"))},32319,(e,t,r)=>{t.exports=e.x("next/dist/server/app-render/work-unit-async-storage.external.js",()=>require("next/dist/server/app-render/work-unit-async-storage.external.js"))},70406,(e,t,r)=>{t.exports=e.x("next/dist/compiled/@opentelemetry/api",()=>require("next/dist/compiled/@opentelemetry/api"))},93695,(e,t,r)=>{t.exports=e.x("next/dist/shared/lib/no-fallback-error.external.js",()=>require("next/dist/shared/lib/no-fallback-error.external.js"))},43793,e=>{"use strict";let t,r;var a,n=e.x("node:sqlite",()=>require("node:sqlite"),!0),s=e.i(66680),o=e.i(2157),i=e.i(50227);let d=process.env.DATA_DIR||i.default.join(process.cwd(),"data");function E(e,t,r,a){e.prepare(`PRAGMA table_info(${t})`).all().some(e=>e.name===r)||e.exec(`ALTER TABLE ${t} ADD COLUMN ${a}`)}let p=globalThis,T=p.__quarkDb??(o.default.mkdirSync(d,{recursive:!0}),(t=new n.DatabaseSync(i.default.join(d,"quark.db"))).exec("PRAGMA busy_timeout = 5000"),t.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS users (
      id            TEXT PRIMARY KEY,
      email         TEXT UNIQUE,
      username      TEXT,
      name          TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      created_at    INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token      TEXT PRIMARY KEY,
      user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS projects (
      id                   TEXT PRIMARY KEY,
      user_id              TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name                 TEXT NOT NULL,
      slug                 TEXT UNIQUE,
      current_version_id   TEXT,
      published_version_id TEXT,
      created_at           INTEGER NOT NULL,
      updated_at           INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS messages (
      id         TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      role       TEXT NOT NULL CHECK (role IN ('user','agent')),
      content    TEXT NOT NULL,
      meta       TEXT,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS app_versions (
      id           TEXT PRIMARY KEY,
      project_id   TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      num          INTEGER NOT NULL,
      html         TEXT NOT NULL,
      spec         TEXT,
      review_notes TEXT,
      prompt       TEXT NOT NULL,
      created_at   INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS jobs (
      id         TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      prompt     TEXT NOT NULL,
      status     TEXT NOT NULL CHECK (status IN ('queued','running','done','error')),
      stage      TEXT,
      error      TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS artifacts (
      id         TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      version_id TEXT NOT NULL REFERENCES app_versions(id),
      seq        INTEGER NOT NULL,
      notes      TEXT,
      created_at INTEGER NOT NULL,
      UNIQUE(project_id, seq)
    );

    CREATE TABLE IF NOT EXISTS attachments (
      id         TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      filename   TEXT NOT NULL,
      mime       TEXT NOT NULL,
      kind       TEXT NOT NULL CHECK (kind IN ('text','image')),
      size       INTEGER NOT NULL,
      data       BLOB NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS templates (
      id          TEXT PRIMARY KEY,
      name        TEXT NOT NULL,
      category    TEXT NOT NULL,
      platform    TEXT NOT NULL CHECK (platform IN ('web','mobile')),
      description TEXT NOT NULL,
      html        TEXT NOT NULL,
      s3_bucket   TEXT,
      s3_key      TEXT,
      created_at  INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS deployments (
      id           TEXT PRIMARY KEY,
      project_id   TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      artifact_seq INTEGER NOT NULL,
      provider     TEXT NOT NULL,
      bucket       TEXT,
      url          TEXT NOT NULL,
      status       TEXT NOT NULL CHECK (status IN ('live','removed')),
      created_at   INTEGER NOT NULL,
      removed_at   INTEGER
    );

    CREATE TABLE IF NOT EXISTS credit_events (
      id         TEXT PRIMARY KEY,
      user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      delta      INTEGER NOT NULL,
      reason     TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS app_kv (
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      k          TEXT NOT NULL,
      v          TEXT NOT NULL,
      updated_at INTEGER NOT NULL,
      PRIMARY KEY (project_id, k)
    );

    CREATE TABLE IF NOT EXISTS redeem_codes (
      code       TEXT PRIMARY KEY,
      amount     INTEGER NOT NULL,
      used_by    TEXT REFERENCES users(id),
      used_at    INTEGER,
      created_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_jobs_project ON jobs(project_id, status);
    CREATE INDEX IF NOT EXISTS idx_projects_gallery ON projects(published_version_id, updated_at);
    CREATE INDEX IF NOT EXISTS idx_messages_project ON messages(project_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_versions_project ON app_versions(project_id, num);
    CREATE INDEX IF NOT EXISTS idx_projects_user ON projects(user_id, updated_at);
  `),E(t,"projects","in_gallery","in_gallery INTEGER NOT NULL DEFAULT 1"),E(t,"projects","platform","platform TEXT NOT NULL DEFAULT 'web' CHECK (platform IN ('web','mobile'))"),E(t,"users","is_demo","is_demo INTEGER NOT NULL DEFAULT 0"),E(t,"jobs","mode","mode TEXT NOT NULL DEFAULT 'fast'"),E(t,"jobs","team","team INTEGER NOT NULL DEFAULT 0"),E(t,"projects","theme","theme TEXT"),E(t,"projects","connectors","connectors TEXT"),E(t,"projects","domain_name","domain_name TEXT"),E(t,"users","credits","credits INTEGER NOT NULL DEFAULT 0"),E(t,"users","plan","plan TEXT NOT NULL DEFAULT 'free'"),E(t,"projects","goal","goal TEXT"),E(t,"projects","goal_active","goal_active INTEGER NOT NULL DEFAULT 0"),E(t,"projects","goal_round","goal_round INTEGER NOT NULL DEFAULT 0"),E(t,"projects","goal_rounds","goal_rounds INTEGER NOT NULL DEFAULT 5"),E(t,"projects","goal_status","goal_status TEXT"),E(t,"projects","acceptance","acceptance TEXT"),E(t,"projects","fused_from","fused_from TEXT"),E(t,"users","username","username TEXT"),r=(a=t).prepare("PRAGMA table_info(users)").all(),r.find(e=>"email"===e.name)?.notnull===1&&(a.exec("PRAGMA foreign_keys = OFF"),a.exec(`
    BEGIN;
    CREATE TABLE users_relaxed (
      id            TEXT PRIMARY KEY,
      email         TEXT UNIQUE,
      username      TEXT,
      name          TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      created_at    INTEGER NOT NULL,
      is_demo       INTEGER NOT NULL DEFAULT 0,
      credits       INTEGER NOT NULL DEFAULT 0,
      plan          TEXT NOT NULL DEFAULT 'free'
    );
    INSERT INTO users_relaxed (id, email, username, name, password_hash, created_at, is_demo, credits, plan)
      SELECT id, email, username, name, password_hash, created_at, is_demo, credits, plan FROM users;
    DROP TABLE users;
    ALTER TABLE users_relaxed RENAME TO users;
    COMMIT;
  `),a.exec("PRAGMA foreign_keys = ON")),t.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON users(lower(username)) WHERE username IS NOT NULL"),t.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_projects_domain ON projects(domain_name) WHERE domain_name IS NOT NULL"),t.exec("CREATE INDEX IF NOT EXISTS idx_credit_events_user ON credit_events(user_id, created_at)"),t.exec(`
    CREATE TABLE IF NOT EXISTS app_reports (
      id           TEXT PRIMARY KEY,
      project_id   TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      artifact_seq INTEGER,
      kind         TEXT NOT NULL CHECK (kind IN ('feedback','error')),
      content      TEXT NOT NULL,
      status       TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new','handled','dismissed')),
      created_at   INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_app_reports_project ON app_reports(project_id, status, created_at);
  `),function(e){let t=e.prepare(`SELECT p.id AS project_id, p.published_version_id AS version_id, v.prompt
       FROM projects p JOIN app_versions v ON v.id = p.published_version_id
       WHERE p.published_version_id IS NOT NULL
         AND NOT EXISTS (SELECT 1 FROM artifacts a WHERE a.project_id = p.id)`).all(),r=e.prepare("INSERT INTO artifacts (id, project_id, version_id, seq, notes, created_at) VALUES (?, ?, ?, 1, ?, ?)");for(let e of t)r.run(`a_${(0,s.randomBytes)(9).toString("base64url")}`,e.project_id,e.version_id,e.prompt,Date.now())}(t),p.__quarkDb=t);e.s(["db",0,T,"now",0,function(){return Date.now()}])},24361,(e,t,r)=>{t.exports=e.x("util",()=>require("util"))},22734,(e,t,r)=>{t.exports=e.x("fs",()=>require("fs"))},88947,(e,t,r)=>{t.exports=e.x("stream",()=>require("stream"))},6461,(e,t,r)=>{t.exports=e.x("zlib",()=>require("zlib"))},49719,(e,t,r)=>{t.exports=e.x("assert",()=>require("assert"))},874,(e,t,r)=>{t.exports=e.x("buffer",()=>require("buffer"))},52035,e=>{"use strict";var t=e.i(33189);function r(e,a,n,s=""){var o;let i,d,E=function(e,t=""){return`<script>(function(){var s=${JSON.stringify(e)};var b=${JSON.stringify(t)}+'/api/apps/'+s+'/kv/';window.quark={slug:s,storage:{
get:async function(k){try{var r=await fetch(b+encodeURIComponent(k));if(!r.ok)return null;return (await r.json()).v}catch(e){try{return localStorage.getItem('qk_'+s+'_'+k)}catch(_){return null}}},
set:async function(k,v){try{var r=await fetch(b+encodeURIComponent(k),{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify({v:String(v)})});if(r.ok)return true;throw 0}catch(e){try{localStorage.setItem('qk_'+s+'_'+k,String(v));return true}catch(_){return false}}}}};})()</script>`}(a,s)+(i=process.env.PLATFORM_ORIGIN||"https://quark.lexarcai.com",`<script>(function(){function add(){var d=document.createElement('div');d.style.cssText='position:fixed;right:12px;bottom:12px;z-index:99999;display:flex;align-items:center;gap:6px;background:rgba(13,14,28,.92);color:#edebff;font:12px/1 -apple-system,sans-serif;padding:7px 10px;border-radius:99px;border:1px solid rgba(139,124,255,.35);box-shadow:0 2px 12px rgba(0,0,0,.25)';d.innerHTML='<a href="${i}/remix/${a}" target="_blank" rel="noopener" style="color:#edebff;text-decoration:none">\\u2600 \\u7528 Fusion \\u6784\\u5efa \\u00b7 <span style="color:#8b7cff">Remix</span></a><span style="cursor:pointer;color:#8d8aa8;padding:0 2px" aria-label="\\u5173\\u95ed">\\u00d7</span>';d.lastChild.onclick=function(){d.remove()};document.body.appendChild(d)}if(document.readyState==='loading'){document.addEventListener('DOMContentLoaded',add)}else{add()}})()</script>`)+(0,t.connectorsHelper)((0,t.parseConnectors)(n.connectors),s);return n.snapshot||(E=function(e,t=""){let r=`${t}/api/apps/${e}/report`;return`<script>(function(){var u=${JSON.stringify(r)};var sent=0,seen={};
function post(k,c){try{fetch(u,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({kind:k,content:String(c).slice(0,500)})}).catch(function(){})}catch(e){}}
window.addEventListener('error',function(e){var m=(e&&e.message)||'脚本错误';if(sent>=3||seen[m])return;seen[m]=1;sent++;post('error',m+(e&&e.lineno?' @行'+e.lineno:''))});
window.addEventListener('unhandledrejection',function(e){var m='Promise 拒绝: '+String(e&&e.reason).slice(0,200);if(sent>=3||seen[m])return;seen[m]=1;sent++;post('error',m)});
function add(){var d=document.createElement('div');d.style.cssText='position:fixed;left:12px;bottom:12px;z-index:99998;font:12px/1.4 -apple-system,sans-serif';
var b=document.createElement('button');b.textContent='\\ud83d\\udcac';b.setAttribute('aria-label','\\u53cd\\u9988');b.style.cssText='width:34px;height:34px;border-radius:99px;border:1px solid rgba(139,124,255,.35);background:rgba(13,14,28,.92);color:#edebff;cursor:pointer;box-shadow:0 2px 12px rgba(0,0,0,.25)';
var p=document.createElement('div');p.style.cssText='display:none;position:absolute;left:0;bottom:42px;width:230px;background:rgba(13,14,28,.96);border:1px solid rgba(139,124,255,.35);border-radius:12px;padding:10px;box-shadow:0 4px 20px rgba(0,0,0,.35)';
p.innerHTML='<div style="color:#edebff;margin-bottom:6px">\\u5bf9\\u8fd9\\u4e2a\\u5e94\\u7528\\u7684\\u5efa\\u8bae\\uff1f</div><textarea rows="3" maxlength="500" style="width:100%;box-sizing:border-box;background:#1a1c33;color:#edebff;border:1px solid #333653;border-radius:8px;padding:6px;font:inherit;resize:none"></textarea><div style="display:flex;gap:6px;margin-top:6px;justify-content:flex-end"><button data-x style="background:none;border:none;color:#8d8aa8;cursor:pointer">\\u53d6\\u6d88</button><button data-ok style="background:#8b7cff;border:none;color:#fff;border-radius:8px;padding:5px 12px;cursor:pointer">\\u53d1\\u9001</button></div>';
b.onclick=function(){p.style.display=p.style.display==='none'?'block':'none'};
p.querySelector('[data-x]').onclick=function(){p.style.display='none'};
p.querySelector('[data-ok]').onclick=function(){var t=p.querySelector('textarea');var v=t.value.trim();if(!v)return;post('feedback',v);p.innerHTML='<div style="color:#edebff;padding:4px">\\u2713 \\u5df2\\u6536\\u5230\\uff0c\\u8c22\\u8c22\\u53cd\\u9988\\uff01</div>';setTimeout(function(){p.style.display='none'},1500)};
d.appendChild(p);d.appendChild(b);document.body.appendChild(d)}
if(document.readyState==='loading'){document.addEventListener('DOMContentLoaded',add)}else{add()}})()</script>`}(a,s)+E),"mobile"!==n.platform||s||(E+=(o=!!n.snapshot,d=`<link rel="manifest" href="/api/apps/${a}/manifest.webmanifest">`,/name="theme-color"/i.test(e)||(d+='<meta name="theme-color" content="#0d0e1c">'),/apple-mobile-web-app-capable/i.test(e)||(d+='<meta name="apple-mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">'),o||(d+="<script>if('serviceWorker' in navigator){var p=location.pathname.replace(/\\/$/,'');navigator.serviceWorker.register(p+'/sw.js',{scope:p}).catch(function(){})}</script>"),d)),/<head[^>]*>/i.test(e)?e.replace(/<head([^>]*)>/i,`<head$1>${E}`):E+e}e.s(["exportAppHtml",0,function(e,t,a={}){return r(e,t,a,"https://quark-apps.lexarcai.com")},"notFoundApp",0,function(){return new Response("<h1>404</h1><p>这个应用不存在或已下线。</p>",{status:404,headers:{"content-type":"text/html; charset=utf-8"}})},"serveAppHtml",0,function(e,t,a={}){return new Response(r(e,t,a),{headers:{"content-type":"text/html; charset=utf-8","cache-control":"no-cache"}})}])},64862,e=>{"use strict";var t=e.i(47909),r=e.i(74017),a=e.i(96250),n=e.i(59756),s=e.i(61916),o=e.i(74677),i=e.i(69741),d=e.i(16795),E=e.i(87718),p=e.i(95169),T=e.i(47587),c=e.i(66012),l=e.i(70101),u=e.i(26937),N=e.i(10372),L=e.i(93695);e.i(20232);var R=e.i(220),m=e.i(43793),f=e.i(52035);async function O(e,t){let{slug:r,seq:a}=await t.params,n=Number(a);if(!Number.isInteger(n)||n<1)return(0,f.notFoundApp)();let s=m.db.prepare(`SELECT v.html, p.platform, p.connectors FROM projects p
       JOIN artifacts a ON a.project_id = p.id AND a.seq = ?
       JOIN app_versions v ON v.id = a.version_id
       WHERE p.slug = ? AND p.published_version_id IS NOT NULL`).get(n,r);return s?(0,f.serveAppHtml)(s.html,r,{platform:s.platform,snapshot:!0,connectors:s.connectors}):(0,f.notFoundApp)()}e.s(["GET",0,O,"dynamic",0,"force-dynamic"],26541);var _=e.i(26541);let x=new t.AppRouteRouteModule({definition:{kind:r.RouteKind.APP_ROUTE,page:"/p/[slug]/v/[seq]/route",pathname:"/p/[slug]/v/[seq]",filename:"route",bundlePath:""},distDir:".next-ci",relativeProjectDir:"",resolvedPagePath:"[project]/src/app/p/[slug]/v/[seq]/route.ts",nextConfigOutput:"",userland:_,...{}}),{workAsyncStorage:A,workUnitAsyncStorage:I,serverHooks:b}=x;async function h(e,t,a){a.requestMeta&&(0,n.setRequestMeta)(e,a.requestMeta),x.isDev&&(0,n.addRequestMeta)(e,"devRequestTimingInternalsEnd",process.hrtime.bigint());let m="/p/[slug]/v/[seq]/route";m=m.replace(/\/index$/,"")||"/";let f=await x.prepare(e,t,{srcPage:m,multiZoneDraftMode:!1});if(!f)return t.statusCode=400,t.end("Bad Request"),null==a.waitUntil||a.waitUntil.call(a,Promise.resolve()),null;let{buildId:O,deploymentId:_,params:A,nextConfig:I,parsedUrl:b,isDraftMode:h,prerenderManifest:v,routerServerContext:C,isOnDemandRevalidate:g,revalidateOnlyGenerated:S,resolvedPathname:U,clientReferenceManifest:X,serverActionsManifest:y}=f,w=(0,i.normalizeAppPath)(m),j=!!(v.dynamicRoutes[w]||v.routes[U]),D=async()=>((null==C?void 0:C.render404)?await C.render404(e,t,b,!1):t.end("This page could not be found"),null);if(j&&!h){let e=!!v.routes[U],t=v.dynamicRoutes[w];if(t&&!1===t.fallback&&!e){if(I.adapterPath)return await D();throw new L.NoFallbackError}}let k=null;!j||x.isDev||h||(k="/index"===(k=U)?"/":k);let F=!0===x.isDev||!j,q=j&&!F;y&&X&&(0,o.setManifestsSingleton)({page:m,clientReferenceManifest:X,serverActionsManifest:y});let M=e.method||"GET",P=(0,s.getTracer)(),G=P.getActiveScopeSpan(),H=!!(null==C?void 0:C.isWrappedByNextServer),K=!!(0,n.getRequestMeta)(e,"minimalMode"),Y=(0,n.getRequestMeta)(e,"incrementalCache")||await x.getIncrementalCache(e,I,v,K);null==Y||Y.resetRequestCache(),globalThis.__incrementalCache=Y;let B={params:A,previewProps:v.preview,renderOpts:{experimental:{authInterrupts:!!I.experimental.authInterrupts},cacheComponents:!!I.cacheComponents,supportsDynamicResponse:F,incrementalCache:Y,cacheLifeProfiles:I.cacheLife,waitUntil:a.waitUntil,onClose:e=>{t.on("close",e)},onAfterTaskError:void 0,onInstrumentationRequestError:(t,r,a,n)=>x.onRequestError(e,t,a,n,C)},sharedContext:{buildId:O,deploymentId:_}},$=new d.NodeNextRequest(e),W=new d.NodeNextResponse(t),z=E.NextRequestAdapter.fromNodeNextRequest($,(0,E.signalFromNodeResponse)(t));try{let n,o=async e=>x.handle(z,B).finally(()=>{if(!e)return;e.setAttributes({"http.status_code":t.statusCode,"next.rsc":!1});let r=P.getRootSpanAttributes();if(!r)return;if(r.get("next.span_type")!==p.BaseServerSpan.handleRequest)return void console.warn(`Unexpected root span type '${r.get("next.span_type")}'. Please report this Next.js issue https://github.com/vercel/next.js`);let a=r.get("next.route");if(a){let t=`${M} ${a}`;e.setAttributes({"next.route":a,"http.route":a,"next.span_name":t}),e.updateName(t),n&&n!==e&&(n.setAttribute("http.route",a),n.updateName(t))}else e.updateName(`${M} ${m}`)}),i=async n=>{var s,i;let d=async({previousCacheEntry:r})=>{try{if(!K&&g&&S&&!r)return t.statusCode=404,t.setHeader("x-nextjs-cache","REVALIDATED"),t.end("This page could not be found"),null;let s=await o(n);e.fetchMetrics=B.renderOpts.fetchMetrics;let i=B.renderOpts.pendingWaitUntil;i&&a.waitUntil&&(a.waitUntil(i),i=void 0);let d=B.renderOpts.collectedTags;if(!j)return await (0,c.sendResponse)($,W,s,B.renderOpts.pendingWaitUntil),null;{let e=await s.blob(),t=(0,l.toNodeOutgoingHttpHeaders)(s.headers);d&&(t[N.NEXT_CACHE_TAGS_HEADER]=d),!t["content-type"]&&e.type&&(t["content-type"]=e.type);let r=void 0!==B.renderOpts.collectedRevalidate&&!(B.renderOpts.collectedRevalidate>=N.INFINITE_CACHE)&&B.renderOpts.collectedRevalidate,a=void 0===B.renderOpts.collectedExpire||B.renderOpts.collectedExpire>=N.INFINITE_CACHE?void 0:B.renderOpts.collectedExpire;return{value:{kind:R.CachedRouteKind.APP_ROUTE,status:s.status,body:Buffer.from(await e.arrayBuffer()),headers:t},cacheControl:{revalidate:r,expire:a}}}}catch(t){throw(null==r?void 0:r.isStale)&&await x.onRequestError(e,t,{routerKind:"App Router",routePath:m,routeType:"route",revalidateReason:(0,T.getRevalidateReason)({isStaticGeneration:q,isOnDemandRevalidate:g})},!1,C),t}},E=await x.handleResponse({req:e,nextConfig:I,cacheKey:k,routeKind:r.RouteKind.APP_ROUTE,isFallback:!1,prerenderManifest:v,isRoutePPREnabled:!1,isOnDemandRevalidate:g,revalidateOnlyGenerated:S,responseGenerator:d,waitUntil:a.waitUntil,isMinimalMode:K});if(!j)return null;if((null==E||null==(s=E.value)?void 0:s.kind)!==R.CachedRouteKind.APP_ROUTE)throw Object.defineProperty(Error(`Invariant: app-route received invalid cache entry ${null==E||null==(i=E.value)?void 0:i.kind}`),"__NEXT_ERROR_CODE",{value:"E701",enumerable:!1,configurable:!0});K||t.setHeader("x-nextjs-cache",g?"REVALIDATED":E.isMiss?"MISS":E.isStale?"STALE":"HIT"),h&&t.setHeader("Cache-Control","private, no-cache, no-store, max-age=0, must-revalidate");let p=(0,l.fromNodeOutgoingHttpHeaders)(E.value.headers);return K&&j||p.delete(N.NEXT_CACHE_TAGS_HEADER),!E.cacheControl||t.getHeader("Cache-Control")||p.get("Cache-Control")||p.set("Cache-Control",(0,u.getCacheControlHeader)(E.cacheControl)),await (0,c.sendResponse)($,W,new Response(E.value.body,{headers:p,status:E.value.status||200})),null};H&&G?await i(G):(n=P.getActiveScopeSpan(),await P.withPropagatedContext(e.headers,()=>P.trace(p.BaseServerSpan.handleRequest,{spanName:`${M} ${m}`,kind:s.SpanKind.SERVER,attributes:{"http.method":M,"http.target":e.url}},i),void 0,!H))}catch(t){if(t instanceof L.NoFallbackError||await x.onRequestError(e,t,{routerKind:"App Router",routePath:w,routeType:"route",revalidateReason:(0,T.getRevalidateReason)({isStaticGeneration:q,isOnDemandRevalidate:g})},!1,C),j)throw t;return await (0,c.sendResponse)($,W,new Response(null,{status:500})),null}}e.s(["handler",0,h,"patchFetch",0,function(){return(0,a.patchFetch)({workAsyncStorage:A,workUnitAsyncStorage:I})},"routeModule",0,x,"serverHooks",0,b,"workAsyncStorage",0,A,"workUnitAsyncStorage",0,I],64862)}];

//# sourceMappingURL=%5Broot-of-the-server%5D__1j1tr16._.js.map