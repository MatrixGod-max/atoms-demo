module.exports=[18622,(e,t,r)=>{t.exports=e.x("next/dist/compiled/next-server/app-page-turbo.runtime.prod.js",()=>require("next/dist/compiled/next-server/app-page-turbo.runtime.prod.js"))},56704,(e,t,r)=>{t.exports=e.x("next/dist/server/app-render/work-async-storage.external.js",()=>require("next/dist/server/app-render/work-async-storage.external.js"))},32319,(e,t,r)=>{t.exports=e.x("next/dist/server/app-render/work-unit-async-storage.external.js",()=>require("next/dist/server/app-render/work-unit-async-storage.external.js"))},24725,(e,t,r)=>{t.exports=e.x("next/dist/server/app-render/after-task-async-storage.external.js",()=>require("next/dist/server/app-render/after-task-async-storage.external.js"))},70406,(e,t,r)=>{t.exports=e.x("next/dist/compiled/@opentelemetry/api",()=>require("next/dist/compiled/@opentelemetry/api"))},93695,(e,t,r)=>{t.exports=e.x("next/dist/shared/lib/no-fallback-error.external.js",()=>require("next/dist/shared/lib/no-fallback-error.external.js"))},66680,(e,t,r)=>{t.exports=e.x("node:crypto",()=>require("node:crypto"))},2157,(e,t,r)=>{t.exports=e.x("node:fs",()=>require("node:fs"))},50227,(e,t,r)=>{t.exports=e.x("node:path",()=>require("node:path"))},43793,e=>{"use strict";let t,r;var a,s=e.x("node:sqlite",()=>require("node:sqlite"),!0),E=e.i(66680),o=e.i(2157),T=e.i(50227);let n=process.env.DATA_DIR||T.default.join(process.cwd(),"data");function i(e,t,r,a){e.prepare(`PRAGMA table_info(${t})`).all().some(e=>e.name===r)||e.exec(`ALTER TABLE ${t} ADD COLUMN ${a}`)}let d=globalThis,N=d.__quarkDb??(o.default.mkdirSync(n,{recursive:!0}),(t=new s.DatabaseSync(T.default.join(n,"quark.db"))).exec("PRAGMA busy_timeout = 5000"),t.exec(`
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
  `),i(t,"projects","in_gallery","in_gallery INTEGER NOT NULL DEFAULT 1"),i(t,"projects","platform","platform TEXT NOT NULL DEFAULT 'web' CHECK (platform IN ('web','mobile'))"),i(t,"users","is_demo","is_demo INTEGER NOT NULL DEFAULT 0"),i(t,"jobs","mode","mode TEXT NOT NULL DEFAULT 'fast'"),i(t,"jobs","team","team INTEGER NOT NULL DEFAULT 0"),i(t,"projects","theme","theme TEXT"),i(t,"projects","connectors","connectors TEXT"),i(t,"projects","domain_name","domain_name TEXT"),i(t,"users","credits","credits INTEGER NOT NULL DEFAULT 0"),i(t,"users","plan","plan TEXT NOT NULL DEFAULT 'free'"),i(t,"projects","goal","goal TEXT"),i(t,"projects","goal_active","goal_active INTEGER NOT NULL DEFAULT 0"),i(t,"projects","goal_round","goal_round INTEGER NOT NULL DEFAULT 0"),i(t,"projects","goal_rounds","goal_rounds INTEGER NOT NULL DEFAULT 5"),i(t,"projects","goal_status","goal_status TEXT"),i(t,"projects","acceptance","acceptance TEXT"),i(t,"projects","fused_from","fused_from TEXT"),i(t,"users","username","username TEXT"),r=(a=t).prepare("PRAGMA table_info(users)").all(),r.find(e=>"email"===e.name)?.notnull===1&&(a.exec("PRAGMA foreign_keys = OFF"),a.exec(`
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
         AND NOT EXISTS (SELECT 1 FROM artifacts a WHERE a.project_id = p.id)`).all(),r=e.prepare("INSERT INTO artifacts (id, project_id, version_id, seq, notes, created_at) VALUES (?, ?, ?, 1, ?, ?)");for(let e of t)r.run(`a_${(0,E.randomBytes)(9).toString("base64url")}`,e.project_id,e.version_id,e.prompt,Date.now())}(t),d.__quarkDb=t);e.s(["db",0,N,"now",0,function(){return Date.now()}])},21199,e=>{"use strict";let t=new Map,r=globalThis;r.__quarkRlSweep||(r.__quarkRlSweep=setInterval(function(){let e=Date.now()-864e5;for(let[r,a]of t){let s=a.filter(t=>t>e);0===s.length?t.delete(r):t.set(r,s)}},6e5)),e.s(["clientIp",0,function(e){let t=e.headers.get("x-forwarded-for");return t?t.split(",")[0].trim():"local"},"rateLimit",0,function(e,r,a){let s=Date.now(),E=(t.get(e)??[]).filter(e=>e>s-a);return E.length>=r?{ok:!1,retryAfterSec:Math.ceil((E[0]+a-s)/1e3)}:(E.push(s),t.set(e,E),{ok:!0,retryAfterSec:0})}])},43673,e=>{"use strict";var t=e.i(47909),r=e.i(74017),a=e.i(96250),s=e.i(59756),E=e.i(61916),o=e.i(74677),T=e.i(69741),n=e.i(16795),i=e.i(87718),d=e.i(95169),N=e.i(47587),p=e.i(66012),l=e.i(70101),u=e.i(26937),c=e.i(10372),L=e.i(93695);e.i(20232);var R=e.i(220),_=e.i(89171),O=e.i(43793),A=e.i(21199);let I={"access-control-allow-origin":"*","access-control-allow-methods":"GET, PUT, OPTIONS","access-control-allow-headers":"content-type"};async function U(){return new Response(null,{status:204,headers:I})}function m(e){return O.db.prepare("SELECT id FROM projects WHERE slug = ? AND published_version_id IS NOT NULL").get(e)}async function C(e,t){let{slug:r,key:a}=await t.params,s=m(r);if(!s)return _.NextResponse.json({error:"应用不存在"},{status:404,headers:I});let E=O.db.prepare("SELECT v FROM app_kv WHERE project_id = ? AND k = ?").get(s.id,a);return E?_.NextResponse.json({v:E.v},{headers:I}):_.NextResponse.json({v:null},{status:404,headers:I})}async function S(e,t){if(!(0,A.rateLimit)(`kv:${(0,A.clientIp)(e)}`,60,6e4).ok)return _.NextResponse.json({error:"写入过于频繁"},{status:429,headers:I});let{slug:r,key:a}=await t.params;if(a.length>64)return _.NextResponse.json({error:"key 过长"},{status:400,headers:I});let s=m(r);if(!s)return _.NextResponse.json({error:"应用不存在"},{status:404,headers:I});let{v:E}=await e.json().catch(()=>({}));return"string"!=typeof E||Buffer.byteLength(E,"utf8")>8192?_.NextResponse.json({error:"值必须是字符串且不超过 8KB"},{status:400,headers:I}):!O.db.prepare("SELECT 1 FROM app_kv WHERE project_id = ? AND k = ?").get(s.id,a)&&O.db.prepare("SELECT COUNT(*) AS c FROM app_kv WHERE project_id = ?").get(s.id).c>=64?_.NextResponse.json({error:"每个应用最多 64 个 key"},{status:400,headers:I}):(O.db.prepare("INSERT INTO app_kv (project_id, k, v, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(project_id, k) DO UPDATE SET v = excluded.v, updated_at = excluded.updated_at").run(s.id,a,E,(0,O.now)()),_.NextResponse.json({ok:!0},{headers:I}))}e.s(["GET",0,C,"OPTIONS",0,U,"PUT",0,S,"dynamic",0,"force-dynamic"],5243);var X=e.i(5243);let h=new t.AppRouteRouteModule({definition:{kind:r.RouteKind.APP_ROUTE,page:"/api/apps/[slug]/kv/[key]/route",pathname:"/api/apps/[slug]/kv/[key]",filename:"route",bundlePath:""},distDir:".next-ci",relativeProjectDir:"",resolvedPagePath:"[project]/src/app/api/apps/[slug]/kv/[key]/route.ts",nextConfigOutput:"",userland:X,...{}}),{workAsyncStorage:v,workUnitAsyncStorage:x,serverHooks:f}=h;async function g(e,t,a){a.requestMeta&&(0,s.setRequestMeta)(e,a.requestMeta),h.isDev&&(0,s.addRequestMeta)(e,"devRequestTimingInternalsEnd",process.hrtime.bigint());let _="/api/apps/[slug]/kv/[key]/route";_=_.replace(/\/index$/,"")||"/";let O=await h.prepare(e,t,{srcPage:_,multiZoneDraftMode:!1});if(!O)return t.statusCode=400,t.end("Bad Request"),null==a.waitUntil||a.waitUntil.call(a,Promise.resolve()),null;let{buildId:A,deploymentId:I,params:U,nextConfig:m,parsedUrl:C,isDraftMode:S,prerenderManifest:X,routerServerContext:v,isOnDemandRevalidate:x,revalidateOnlyGenerated:f,resolvedPathname:g,clientReferenceManifest:j,serverActionsManifest:D}=O,w=(0,T.normalizeAppPath)(_),F=!!(X.dynamicRoutes[w]||X.routes[g]),y=async()=>((null==v?void 0:v.render404)?await v.render404(e,t,C,!1):t.end("This page could not be found"),null);if(F&&!S){let e=!!X.routes[g],t=X.dynamicRoutes[w];if(t&&!1===t.fallback&&!e){if(m.adapterPath)return await y();throw new L.NoFallbackError}}let b=null;!F||h.isDev||S||(b="/index"===(b=g)?"/":b);let k=!0===h.isDev||!F,P=F&&!k;D&&j&&(0,o.setManifestsSingleton)({page:_,clientReferenceManifest:j,serverActionsManifest:D});let M=e.method||"GET",G=(0,E.getTracer)(),q=G.getActiveScopeSpan(),H=!!(null==v?void 0:v.isWrappedByNextServer),K=!!(0,s.getRequestMeta)(e,"minimalMode"),B=(0,s.getRequestMeta)(e,"incrementalCache")||await h.getIncrementalCache(e,m,X,K);null==B||B.resetRequestCache(),globalThis.__incrementalCache=B;let Y={params:U,previewProps:X.preview,renderOpts:{experimental:{authInterrupts:!!m.experimental.authInterrupts},cacheComponents:!!m.cacheComponents,supportsDynamicResponse:k,incrementalCache:B,cacheLifeProfiles:m.cacheLife,waitUntil:a.waitUntil,onClose:e=>{t.on("close",e)},onAfterTaskError:void 0,onInstrumentationRequestError:(t,r,a,s)=>h.onRequestError(e,t,a,s,v)},sharedContext:{buildId:A,deploymentId:I}},$=new n.NodeNextRequest(e),W=new n.NodeNextResponse(t),Q=i.NextRequestAdapter.fromNodeNextRequest($,(0,i.signalFromNodeResponse)(t));try{let s,o=async e=>h.handle(Q,Y).finally(()=>{if(!e)return;e.setAttributes({"http.status_code":t.statusCode,"next.rsc":!1});let r=G.getRootSpanAttributes();if(!r)return;if(r.get("next.span_type")!==d.BaseServerSpan.handleRequest)return void console.warn(`Unexpected root span type '${r.get("next.span_type")}'. Please report this Next.js issue https://github.com/vercel/next.js`);let a=r.get("next.route");if(a){let t=`${M} ${a}`;e.setAttributes({"next.route":a,"http.route":a,"next.span_name":t}),e.updateName(t),s&&s!==e&&(s.setAttribute("http.route",a),s.updateName(t))}else e.updateName(`${M} ${_}`)}),T=async s=>{var E,T;let n=async({previousCacheEntry:r})=>{try{if(!K&&x&&f&&!r)return t.statusCode=404,t.setHeader("x-nextjs-cache","REVALIDATED"),t.end("This page could not be found"),null;let E=await o(s);e.fetchMetrics=Y.renderOpts.fetchMetrics;let T=Y.renderOpts.pendingWaitUntil;T&&a.waitUntil&&(a.waitUntil(T),T=void 0);let n=Y.renderOpts.collectedTags;if(!F)return await (0,p.sendResponse)($,W,E,Y.renderOpts.pendingWaitUntil),null;{let e=await E.blob(),t=(0,l.toNodeOutgoingHttpHeaders)(E.headers);n&&(t[c.NEXT_CACHE_TAGS_HEADER]=n),!t["content-type"]&&e.type&&(t["content-type"]=e.type);let r=void 0!==Y.renderOpts.collectedRevalidate&&!(Y.renderOpts.collectedRevalidate>=c.INFINITE_CACHE)&&Y.renderOpts.collectedRevalidate,a=void 0===Y.renderOpts.collectedExpire||Y.renderOpts.collectedExpire>=c.INFINITE_CACHE?void 0:Y.renderOpts.collectedExpire;return{value:{kind:R.CachedRouteKind.APP_ROUTE,status:E.status,body:Buffer.from(await e.arrayBuffer()),headers:t},cacheControl:{revalidate:r,expire:a}}}}catch(t){throw(null==r?void 0:r.isStale)&&await h.onRequestError(e,t,{routerKind:"App Router",routePath:_,routeType:"route",revalidateReason:(0,N.getRevalidateReason)({isStaticGeneration:P,isOnDemandRevalidate:x})},!1,v),t}},i=await h.handleResponse({req:e,nextConfig:m,cacheKey:b,routeKind:r.RouteKind.APP_ROUTE,isFallback:!1,prerenderManifest:X,isRoutePPREnabled:!1,isOnDemandRevalidate:x,revalidateOnlyGenerated:f,responseGenerator:n,waitUntil:a.waitUntil,isMinimalMode:K});if(!F)return null;if((null==i||null==(E=i.value)?void 0:E.kind)!==R.CachedRouteKind.APP_ROUTE)throw Object.defineProperty(Error(`Invariant: app-route received invalid cache entry ${null==i||null==(T=i.value)?void 0:T.kind}`),"__NEXT_ERROR_CODE",{value:"E701",enumerable:!1,configurable:!0});K||t.setHeader("x-nextjs-cache",x?"REVALIDATED":i.isMiss?"MISS":i.isStale?"STALE":"HIT"),S&&t.setHeader("Cache-Control","private, no-cache, no-store, max-age=0, must-revalidate");let d=(0,l.fromNodeOutgoingHttpHeaders)(i.value.headers);return K&&F||d.delete(c.NEXT_CACHE_TAGS_HEADER),!i.cacheControl||t.getHeader("Cache-Control")||d.get("Cache-Control")||d.set("Cache-Control",(0,u.getCacheControlHeader)(i.cacheControl)),await (0,p.sendResponse)($,W,new Response(i.value.body,{headers:d,status:i.value.status||200})),null};H&&q?await T(q):(s=G.getActiveScopeSpan(),await G.withPropagatedContext(e.headers,()=>G.trace(d.BaseServerSpan.handleRequest,{spanName:`${M} ${_}`,kind:E.SpanKind.SERVER,attributes:{"http.method":M,"http.target":e.url}},T),void 0,!H))}catch(t){if(t instanceof L.NoFallbackError||await h.onRequestError(e,t,{routerKind:"App Router",routePath:w,routeType:"route",revalidateReason:(0,N.getRevalidateReason)({isStaticGeneration:P,isOnDemandRevalidate:x})},!1,v),F)throw t;return await (0,p.sendResponse)($,W,new Response(null,{status:500})),null}}e.s(["handler",0,g,"patchFetch",0,function(){return(0,a.patchFetch)({workAsyncStorage:v,workUnitAsyncStorage:x})},"routeModule",0,h,"serverHooks",0,f,"workAsyncStorage",0,v,"workUnitAsyncStorage",0,x],43673)}];

//# sourceMappingURL=%5Broot-of-the-server%5D__0-wu1lt._.js.map