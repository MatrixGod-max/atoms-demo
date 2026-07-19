module.exports=[66680,(e,t,r)=>{t.exports=e.x("node:crypto",()=>require("node:crypto"))},2157,(e,t,r)=>{t.exports=e.x("node:fs",()=>require("node:fs"))},50227,(e,t,r)=>{t.exports=e.x("node:path",()=>require("node:path"))},18622,(e,t,r)=>{t.exports=e.x("next/dist/compiled/next-server/app-page-turbo.runtime.prod.js",()=>require("next/dist/compiled/next-server/app-page-turbo.runtime.prod.js"))},56704,(e,t,r)=>{t.exports=e.x("next/dist/server/app-render/work-async-storage.external.js",()=>require("next/dist/server/app-render/work-async-storage.external.js"))},32319,(e,t,r)=>{t.exports=e.x("next/dist/server/app-render/work-unit-async-storage.external.js",()=>require("next/dist/server/app-render/work-unit-async-storage.external.js"))},70406,(e,t,r)=>{t.exports=e.x("next/dist/compiled/@opentelemetry/api",()=>require("next/dist/compiled/@opentelemetry/api"))},93695,(e,t,r)=>{t.exports=e.x("next/dist/shared/lib/no-fallback-error.external.js",()=>require("next/dist/shared/lib/no-fallback-error.external.js"))},43793,e=>{"use strict";let t,r;var a,s=e.x("node:sqlite",()=>require("node:sqlite"),!0),E=e.i(66680),T=e.i(2157),i=e.i(50227);let n=process.env.DATA_DIR||i.default.join(process.cwd(),"data");function o(e,t,r,a){e.prepare(`PRAGMA table_info(${t})`).all().some(e=>e.name===r)||e.exec(`ALTER TABLE ${t} ADD COLUMN ${a}`)}let d=globalThis,N=d.__quarkDb??(T.default.mkdirSync(n,{recursive:!0}),(t=new s.DatabaseSync(i.default.join(n,"quark.db"))).exec("PRAGMA busy_timeout = 5000"),t.exec(`
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
  `),o(t,"projects","in_gallery","in_gallery INTEGER NOT NULL DEFAULT 1"),o(t,"projects","platform","platform TEXT NOT NULL DEFAULT 'web' CHECK (platform IN ('web','mobile'))"),o(t,"users","is_demo","is_demo INTEGER NOT NULL DEFAULT 0"),o(t,"jobs","mode","mode TEXT NOT NULL DEFAULT 'fast'"),o(t,"jobs","team","team INTEGER NOT NULL DEFAULT 0"),o(t,"projects","theme","theme TEXT"),o(t,"projects","connectors","connectors TEXT"),o(t,"projects","domain_name","domain_name TEXT"),o(t,"users","credits","credits INTEGER NOT NULL DEFAULT 0"),o(t,"users","plan","plan TEXT NOT NULL DEFAULT 'free'"),o(t,"projects","goal","goal TEXT"),o(t,"projects","goal_active","goal_active INTEGER NOT NULL DEFAULT 0"),o(t,"projects","goal_round","goal_round INTEGER NOT NULL DEFAULT 0"),o(t,"projects","goal_rounds","goal_rounds INTEGER NOT NULL DEFAULT 5"),o(t,"projects","goal_status","goal_status TEXT"),o(t,"projects","acceptance","acceptance TEXT"),o(t,"projects","fused_from","fused_from TEXT"),o(t,"users","username","username TEXT"),r=(a=t).prepare("PRAGMA table_info(users)").all(),r.find(e=>"email"===e.name)?.notnull===1&&(a.exec("PRAGMA foreign_keys = OFF"),a.exec(`
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
         AND NOT EXISTS (SELECT 1 FROM artifacts a WHERE a.project_id = p.id)`).all(),r=e.prepare("INSERT INTO artifacts (id, project_id, version_id, seq, notes, created_at) VALUES (?, ?, ?, 1, ?, ?)");for(let e of t)r.run(`a_${(0,E.randomBytes)(9).toString("base64url")}`,e.project_id,e.version_id,e.prompt,Date.now())}(t),d.__quarkDb=t);e.s(["db",0,N,"now",0,function(){return Date.now()}])},84410,e=>{"use strict";var t=e.i(47909),r=e.i(74017),a=e.i(96250),s=e.i(59756),E=e.i(61916),T=e.i(74677),i=e.i(69741),n=e.i(16795),o=e.i(87718),d=e.i(95169),N=e.i(47587),p=e.i(66012),c=e.i(70101),l=e.i(26937),u=e.i(10372),L=e.i(93695);e.i(20232);var R=e.i(220),_=e.i(43793);async function O(e,t){let{slug:r}=await t.params,a=_.db.prepare(`SELECT COALESCE(a.seq, 0) AS seq FROM projects p
       LEFT JOIN artifacts a ON a.project_id = p.id AND a.version_id = p.published_version_id
       WHERE p.slug = ? AND p.published_version_id IS NOT NULL`).get(r);return a?new Response(`const CACHE='quark-${r}-a${a.seq}';
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',e=>e.waitUntil(
  caches.keys()
    .then(ks=>Promise.all(ks.filter(k=>k.startsWith('quark-${r}-')&&k!==CACHE).map(k=>caches.delete(k))))
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
});`,{headers:{"content-type":"application/javascript; charset=utf-8","service-worker-allowed":"/","cache-control":"no-cache"}}):new Response("// gone",{status:404,headers:{"content-type":"application/javascript"}})}e.s(["GET",0,O,"dynamic",0,"force-dynamic"],32496);var A=e.i(32496);let I=new t.AppRouteRouteModule({definition:{kind:r.RouteKind.APP_ROUTE,page:"/p/[slug]/sw.js/route",pathname:"/p/[slug]/sw.js",filename:"route",bundlePath:""},distDir:".next-ci",relativeProjectDir:"",resolvedPagePath:"[project]/src/app/p/[slug]/sw.js/route.ts",nextConfigOutput:"",userland:A,...{}}),{workAsyncStorage:m,workUnitAsyncStorage:C,serverHooks:U}=I;async function X(e,t,a){a.requestMeta&&(0,s.setRequestMeta)(e,a.requestMeta),I.isDev&&(0,s.addRequestMeta)(e,"devRequestTimingInternalsEnd",process.hrtime.bigint());let _="/p/[slug]/sw.js/route";_=_.replace(/\/index$/,"")||"/";let O=await I.prepare(e,t,{srcPage:_,multiZoneDraftMode:!1});if(!O)return t.statusCode=400,t.end("Bad Request"),null==a.waitUntil||a.waitUntil.call(a,Promise.resolve()),null;let{buildId:A,deploymentId:m,params:C,nextConfig:U,parsedUrl:X,isDraftMode:S,prerenderManifest:h,routerServerContext:v,isOnDemandRevalidate:x,revalidateOnlyGenerated:f,resolvedPathname:g,clientReferenceManifest:j,serverActionsManifest:D}=O,w=(0,i.normalizeAppPath)(_),F=!!(h.dynamicRoutes[w]||h.routes[g]),b=async()=>((null==v?void 0:v.render404)?await v.render404(e,t,X,!1):t.end("This page could not be found"),null);if(F&&!S){let e=!!h.routes[g],t=h.dynamicRoutes[w];if(t&&!1===t.fallback&&!e){if(U.adapterPath)return await b();throw new L.NoFallbackError}}let y=null;!F||I.isDev||S||(y="/index"===(y=g)?"/":y);let k=!0===I.isDev||!F,P=F&&!k;D&&j&&(0,T.setManifestsSingleton)({page:_,clientReferenceManifest:j,serverActionsManifest:D});let q=e.method||"GET",G=(0,E.getTracer)(),M=G.getActiveScopeSpan(),H=!!(null==v?void 0:v.isWrappedByNextServer),K=!!(0,s.getRequestMeta)(e,"minimalMode"),Y=(0,s.getRequestMeta)(e,"incrementalCache")||await I.getIncrementalCache(e,U,h,K);null==Y||Y.resetRequestCache(),globalThis.__incrementalCache=Y;let B={params:C,previewProps:h.preview,renderOpts:{experimental:{authInterrupts:!!U.experimental.authInterrupts},cacheComponents:!!U.cacheComponents,supportsDynamicResponse:k,incrementalCache:Y,cacheLifeProfiles:U.cacheLife,waitUntil:a.waitUntil,onClose:e=>{t.on("close",e)},onAfterTaskError:void 0,onInstrumentationRequestError:(t,r,a,s)=>I.onRequestError(e,t,a,s,v)},sharedContext:{buildId:A,deploymentId:m}},$=new n.NodeNextRequest(e),W=new n.NodeNextResponse(t),Q=o.NextRequestAdapter.fromNodeNextRequest($,(0,o.signalFromNodeResponse)(t));try{let s,T=async e=>I.handle(Q,B).finally(()=>{if(!e)return;e.setAttributes({"http.status_code":t.statusCode,"next.rsc":!1});let r=G.getRootSpanAttributes();if(!r)return;if(r.get("next.span_type")!==d.BaseServerSpan.handleRequest)return void console.warn(`Unexpected root span type '${r.get("next.span_type")}'. Please report this Next.js issue https://github.com/vercel/next.js`);let a=r.get("next.route");if(a){let t=`${q} ${a}`;e.setAttributes({"next.route":a,"http.route":a,"next.span_name":t}),e.updateName(t),s&&s!==e&&(s.setAttribute("http.route",a),s.updateName(t))}else e.updateName(`${q} ${_}`)}),i=async s=>{var E,i;let n=async({previousCacheEntry:r})=>{try{if(!K&&x&&f&&!r)return t.statusCode=404,t.setHeader("x-nextjs-cache","REVALIDATED"),t.end("This page could not be found"),null;let E=await T(s);e.fetchMetrics=B.renderOpts.fetchMetrics;let i=B.renderOpts.pendingWaitUntil;i&&a.waitUntil&&(a.waitUntil(i),i=void 0);let n=B.renderOpts.collectedTags;if(!F)return await (0,p.sendResponse)($,W,E,B.renderOpts.pendingWaitUntil),null;{let e=await E.blob(),t=(0,c.toNodeOutgoingHttpHeaders)(E.headers);n&&(t[u.NEXT_CACHE_TAGS_HEADER]=n),!t["content-type"]&&e.type&&(t["content-type"]=e.type);let r=void 0!==B.renderOpts.collectedRevalidate&&!(B.renderOpts.collectedRevalidate>=u.INFINITE_CACHE)&&B.renderOpts.collectedRevalidate,a=void 0===B.renderOpts.collectedExpire||B.renderOpts.collectedExpire>=u.INFINITE_CACHE?void 0:B.renderOpts.collectedExpire;return{value:{kind:R.CachedRouteKind.APP_ROUTE,status:E.status,body:Buffer.from(await e.arrayBuffer()),headers:t},cacheControl:{revalidate:r,expire:a}}}}catch(t){throw(null==r?void 0:r.isStale)&&await I.onRequestError(e,t,{routerKind:"App Router",routePath:_,routeType:"route",revalidateReason:(0,N.getRevalidateReason)({isStaticGeneration:P,isOnDemandRevalidate:x})},!1,v),t}},o=await I.handleResponse({req:e,nextConfig:U,cacheKey:y,routeKind:r.RouteKind.APP_ROUTE,isFallback:!1,prerenderManifest:h,isRoutePPREnabled:!1,isOnDemandRevalidate:x,revalidateOnlyGenerated:f,responseGenerator:n,waitUntil:a.waitUntil,isMinimalMode:K});if(!F)return null;if((null==o||null==(E=o.value)?void 0:E.kind)!==R.CachedRouteKind.APP_ROUTE)throw Object.defineProperty(Error(`Invariant: app-route received invalid cache entry ${null==o||null==(i=o.value)?void 0:i.kind}`),"__NEXT_ERROR_CODE",{value:"E701",enumerable:!1,configurable:!0});K||t.setHeader("x-nextjs-cache",x?"REVALIDATED":o.isMiss?"MISS":o.isStale?"STALE":"HIT"),S&&t.setHeader("Cache-Control","private, no-cache, no-store, max-age=0, must-revalidate");let d=(0,c.fromNodeOutgoingHttpHeaders)(o.value.headers);return K&&F||d.delete(u.NEXT_CACHE_TAGS_HEADER),!o.cacheControl||t.getHeader("Cache-Control")||d.get("Cache-Control")||d.set("Cache-Control",(0,l.getCacheControlHeader)(o.cacheControl)),await (0,p.sendResponse)($,W,new Response(o.value.body,{headers:d,status:o.value.status||200})),null};H&&M?await i(M):(s=G.getActiveScopeSpan(),await G.withPropagatedContext(e.headers,()=>G.trace(d.BaseServerSpan.handleRequest,{spanName:`${q} ${_}`,kind:E.SpanKind.SERVER,attributes:{"http.method":q,"http.target":e.url}},i),void 0,!H))}catch(t){if(t instanceof L.NoFallbackError||await I.onRequestError(e,t,{routerKind:"App Router",routePath:w,routeType:"route",revalidateReason:(0,N.getRevalidateReason)({isStaticGeneration:P,isOnDemandRevalidate:x})},!1,v),F)throw t;return await (0,p.sendResponse)($,W,new Response(null,{status:500})),null}}e.s(["handler",0,X,"patchFetch",0,function(){return(0,a.patchFetch)({workAsyncStorage:m,workUnitAsyncStorage:C})},"routeModule",0,I,"serverHooks",0,U,"workAsyncStorage",0,m,"workUnitAsyncStorage",0,C],84410)}];

//# sourceMappingURL=%5Broot-of-the-server%5D__055co10._.js.map