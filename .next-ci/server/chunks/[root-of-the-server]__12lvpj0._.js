module.exports=[18622,(e,t,r)=>{t.exports=e.x("next/dist/compiled/next-server/app-page-turbo.runtime.prod.js",()=>require("next/dist/compiled/next-server/app-page-turbo.runtime.prod.js"))},56704,(e,t,r)=>{t.exports=e.x("next/dist/server/app-render/work-async-storage.external.js",()=>require("next/dist/server/app-render/work-async-storage.external.js"))},32319,(e,t,r)=>{t.exports=e.x("next/dist/server/app-render/work-unit-async-storage.external.js",()=>require("next/dist/server/app-render/work-unit-async-storage.external.js"))},24725,(e,t,r)=>{t.exports=e.x("next/dist/server/app-render/after-task-async-storage.external.js",()=>require("next/dist/server/app-render/after-task-async-storage.external.js"))},70406,(e,t,r)=>{t.exports=e.x("next/dist/compiled/@opentelemetry/api",()=>require("next/dist/compiled/@opentelemetry/api"))},93695,(e,t,r)=>{t.exports=e.x("next/dist/shared/lib/no-fallback-error.external.js",()=>require("next/dist/shared/lib/no-fallback-error.external.js"))},66680,(e,t,r)=>{t.exports=e.x("node:crypto",()=>require("node:crypto"))},2157,(e,t,r)=>{t.exports=e.x("node:fs",()=>require("node:fs"))},50227,(e,t,r)=>{t.exports=e.x("node:path",()=>require("node:path"))},43793,e=>{"use strict";let t,r;var a,s=e.x("node:sqlite",()=>require("node:sqlite"),!0),E=e.i(66680),o=e.i(2157),n=e.i(50227);let T=process.env.DATA_DIR||n.default.join(process.cwd(),"data");function i(e,t,r,a){e.prepare(`PRAGMA table_info(${t})`).all().some(e=>e.name===r)||e.exec(`ALTER TABLE ${t} ADD COLUMN ${a}`)}let d=globalThis,N=d.__quarkDb??(o.default.mkdirSync(T,{recursive:!0}),(t=new s.DatabaseSync(n.default.join(T,"quark.db"))).exec("PRAGMA busy_timeout = 5000"),t.exec(`
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
         AND NOT EXISTS (SELECT 1 FROM artifacts a WHERE a.project_id = p.id)`).all(),r=e.prepare("INSERT INTO artifacts (id, project_id, version_id, seq, notes, created_at) VALUES (?, ?, ?, 1, ?, ?)");for(let e of t)r.run(`a_${(0,E.randomBytes)(9).toString("base64url")}`,e.project_id,e.version_id,e.prompt,Date.now())}(t),d.__quarkDb=t);e.s(["db",0,N,"now",0,function(){return Date.now()}])},21199,e=>{"use strict";let t=new Map,r=globalThis;r.__quarkRlSweep||(r.__quarkRlSweep=setInterval(function(){let e=Date.now()-864e5;for(let[r,a]of t){let s=a.filter(t=>t>e);0===s.length?t.delete(r):t.set(r,s)}},6e5)),e.s(["clientIp",0,function(e){let t=e.headers.get("x-forwarded-for");return t?t.split(",")[0].trim():"local"},"rateLimit",0,function(e,r,a){let s=Date.now(),E=(t.get(e)??[]).filter(e=>e>s-a);return E.length>=r?{ok:!1,retryAfterSec:Math.ceil((E[0]+a-s)/1e3)}:(E.push(s),t.set(e,E),{ok:!0,retryAfterSec:0})}])},88607,e=>{"use strict";var t=e.i(47909),r=e.i(74017),a=e.i(96250),s=e.i(59756),E=e.i(61916),o=e.i(74677),n=e.i(69741),T=e.i(16795),i=e.i(87718),d=e.i(95169),N=e.i(47587),p=e.i(66012),l=e.i(70101),c=e.i(26937),u=e.i(10372),L=e.i(93695);e.i(20232);var R=e.i(220),_=e.i(89171),O=e.i(43793),A=e.i(79832),I=e.i(21199);let m={"access-control-allow-origin":"*","access-control-allow-methods":"POST, OPTIONS","access-control-allow-headers":"content-type"};async function S(){return new Response(null,{status:204,headers:m})}async function U(e,t){let{slug:r}=await t.params;if(!(0,I.rateLimit)(`report:${(0,I.clientIp)(e)}:${r}`,5,6e4).ok)return _.NextResponse.json({error:"提交过于频繁"},{status:429,headers:m});let a=O.db.prepare("SELECT id FROM projects WHERE slug = ? AND published_version_id IS NOT NULL").get(r);if(!a)return _.NextResponse.json({error:"应用不存在"},{status:404,headers:m});let{kind:s,content:E}=await e.json().catch(()=>({}));if("feedback"!==s&&"error"!==s)return _.NextResponse.json({error:"kind 必须是 feedback 或 error"},{status:400,headers:m});let o="string"==typeof E?E.trim().slice(0,500):"";if(!o)return _.NextResponse.json({error:"内容不能为空"},{status:400,headers:m});if("error"===s&&O.db.prepare("SELECT 1 FROM app_reports WHERE project_id = ? AND kind = 'error' AND content = ? AND status = 'new'").get(a.id,o))return _.NextResponse.json({ok:!0,deduped:!0},{headers:m});if(O.db.prepare("SELECT COUNT(*) AS c FROM app_reports WHERE project_id = ?").get(a.id).c>=200)return _.NextResponse.json({error:"该应用的反馈箱已满"},{status:429,headers:m});let n=O.db.prepare("SELECT MAX(seq) AS m FROM artifacts WHERE project_id = ?").get(a.id).m;return O.db.prepare("INSERT INTO app_reports (id, project_id, artifact_seq, kind, content, created_at) VALUES (?, ?, ?, ?, ?, ?)").run((0,A.newId)("r"),a.id,n,s,o,(0,O.now)()),_.NextResponse.json({ok:!0},{headers:m})}e.s(["OPTIONS",0,S,"POST",0,U,"dynamic",0,"force-dynamic"],21122);var C=e.i(21122);let X=new t.AppRouteRouteModule({definition:{kind:r.RouteKind.APP_ROUTE,page:"/api/apps/[slug]/report/route",pathname:"/api/apps/[slug]/report",filename:"route",bundlePath:""},distDir:".next-ci",relativeProjectDir:"",resolvedPagePath:"[project]/src/app/api/apps/[slug]/report/route.ts",nextConfigOutput:"",userland:C,...{}}),{workAsyncStorage:h,workUnitAsyncStorage:f,serverHooks:x}=X;async function v(e,t,a){a.requestMeta&&(0,s.setRequestMeta)(e,a.requestMeta),X.isDev&&(0,s.addRequestMeta)(e,"devRequestTimingInternalsEnd",process.hrtime.bigint());let _="/api/apps/[slug]/report/route";_=_.replace(/\/index$/,"")||"/";let O=await X.prepare(e,t,{srcPage:_,multiZoneDraftMode:!1});if(!O)return t.statusCode=400,t.end("Bad Request"),null==a.waitUntil||a.waitUntil.call(a,Promise.resolve()),null;let{buildId:A,deploymentId:I,params:m,nextConfig:S,parsedUrl:U,isDraftMode:C,prerenderManifest:h,routerServerContext:f,isOnDemandRevalidate:x,revalidateOnlyGenerated:v,resolvedPathname:g,clientReferenceManifest:j,serverActionsManifest:D}=O,w=(0,n.normalizeAppPath)(_),F=!!(h.dynamicRoutes[w]||h.routes[g]),b=async()=>((null==f?void 0:f.render404)?await f.render404(e,t,U,!1):t.end("This page could not be found"),null);if(F&&!C){let e=!!h.routes[g],t=h.dynamicRoutes[w];if(t&&!1===t.fallback&&!e){if(S.adapterPath)return await b();throw new L.NoFallbackError}}let y=null;!F||X.isDev||C||(y="/index"===(y=g)?"/":y);let k=!0===X.isDev||!F,M=F&&!k;D&&j&&(0,o.setManifestsSingleton)({page:_,clientReferenceManifest:j,serverActionsManifest:D});let P=e.method||"GET",G=(0,E.getTracer)(),q=G.getActiveScopeSpan(),H=!!(null==f?void 0:f.isWrappedByNextServer),K=!!(0,s.getRequestMeta)(e,"minimalMode"),Y=(0,s.getRequestMeta)(e,"incrementalCache")||await X.getIncrementalCache(e,S,h,K);null==Y||Y.resetRequestCache(),globalThis.__incrementalCache=Y;let B={params:m,previewProps:h.preview,renderOpts:{experimental:{authInterrupts:!!S.experimental.authInterrupts},cacheComponents:!!S.cacheComponents,supportsDynamicResponse:k,incrementalCache:Y,cacheLifeProfiles:S.cacheLife,waitUntil:a.waitUntil,onClose:e=>{t.on("close",e)},onAfterTaskError:void 0,onInstrumentationRequestError:(t,r,a,s)=>X.onRequestError(e,t,a,s,f)},sharedContext:{buildId:A,deploymentId:I}},$=new T.NodeNextRequest(e),W=new T.NodeNextResponse(t),Q=i.NextRequestAdapter.fromNodeNextRequest($,(0,i.signalFromNodeResponse)(t));try{let s,o=async e=>X.handle(Q,B).finally(()=>{if(!e)return;e.setAttributes({"http.status_code":t.statusCode,"next.rsc":!1});let r=G.getRootSpanAttributes();if(!r)return;if(r.get("next.span_type")!==d.BaseServerSpan.handleRequest)return void console.warn(`Unexpected root span type '${r.get("next.span_type")}'. Please report this Next.js issue https://github.com/vercel/next.js`);let a=r.get("next.route");if(a){let t=`${P} ${a}`;e.setAttributes({"next.route":a,"http.route":a,"next.span_name":t}),e.updateName(t),s&&s!==e&&(s.setAttribute("http.route",a),s.updateName(t))}else e.updateName(`${P} ${_}`)}),n=async s=>{var E,n;let T=async({previousCacheEntry:r})=>{try{if(!K&&x&&v&&!r)return t.statusCode=404,t.setHeader("x-nextjs-cache","REVALIDATED"),t.end("This page could not be found"),null;let E=await o(s);e.fetchMetrics=B.renderOpts.fetchMetrics;let n=B.renderOpts.pendingWaitUntil;n&&a.waitUntil&&(a.waitUntil(n),n=void 0);let T=B.renderOpts.collectedTags;if(!F)return await (0,p.sendResponse)($,W,E,B.renderOpts.pendingWaitUntil),null;{let e=await E.blob(),t=(0,l.toNodeOutgoingHttpHeaders)(E.headers);T&&(t[u.NEXT_CACHE_TAGS_HEADER]=T),!t["content-type"]&&e.type&&(t["content-type"]=e.type);let r=void 0!==B.renderOpts.collectedRevalidate&&!(B.renderOpts.collectedRevalidate>=u.INFINITE_CACHE)&&B.renderOpts.collectedRevalidate,a=void 0===B.renderOpts.collectedExpire||B.renderOpts.collectedExpire>=u.INFINITE_CACHE?void 0:B.renderOpts.collectedExpire;return{value:{kind:R.CachedRouteKind.APP_ROUTE,status:E.status,body:Buffer.from(await e.arrayBuffer()),headers:t},cacheControl:{revalidate:r,expire:a}}}}catch(t){throw(null==r?void 0:r.isStale)&&await X.onRequestError(e,t,{routerKind:"App Router",routePath:_,routeType:"route",revalidateReason:(0,N.getRevalidateReason)({isStaticGeneration:M,isOnDemandRevalidate:x})},!1,f),t}},i=await X.handleResponse({req:e,nextConfig:S,cacheKey:y,routeKind:r.RouteKind.APP_ROUTE,isFallback:!1,prerenderManifest:h,isRoutePPREnabled:!1,isOnDemandRevalidate:x,revalidateOnlyGenerated:v,responseGenerator:T,waitUntil:a.waitUntil,isMinimalMode:K});if(!F)return null;if((null==i||null==(E=i.value)?void 0:E.kind)!==R.CachedRouteKind.APP_ROUTE)throw Object.defineProperty(Error(`Invariant: app-route received invalid cache entry ${null==i||null==(n=i.value)?void 0:n.kind}`),"__NEXT_ERROR_CODE",{value:"E701",enumerable:!1,configurable:!0});K||t.setHeader("x-nextjs-cache",x?"REVALIDATED":i.isMiss?"MISS":i.isStale?"STALE":"HIT"),C&&t.setHeader("Cache-Control","private, no-cache, no-store, max-age=0, must-revalidate");let d=(0,l.fromNodeOutgoingHttpHeaders)(i.value.headers);return K&&F||d.delete(u.NEXT_CACHE_TAGS_HEADER),!i.cacheControl||t.getHeader("Cache-Control")||d.get("Cache-Control")||d.set("Cache-Control",(0,c.getCacheControlHeader)(i.cacheControl)),await (0,p.sendResponse)($,W,new Response(i.value.body,{headers:d,status:i.value.status||200})),null};H&&q?await n(q):(s=G.getActiveScopeSpan(),await G.withPropagatedContext(e.headers,()=>G.trace(d.BaseServerSpan.handleRequest,{spanName:`${P} ${_}`,kind:E.SpanKind.SERVER,attributes:{"http.method":P,"http.target":e.url}},n),void 0,!H))}catch(t){if(t instanceof L.NoFallbackError||await X.onRequestError(e,t,{routerKind:"App Router",routePath:w,routeType:"route",revalidateReason:(0,N.getRevalidateReason)({isStaticGeneration:M,isOnDemandRevalidate:x})},!1,f),F)throw t;return await (0,p.sendResponse)($,W,new Response(null,{status:500})),null}}e.s(["handler",0,v,"patchFetch",0,function(){return(0,a.patchFetch)({workAsyncStorage:h,workUnitAsyncStorage:f})},"routeModule",0,X,"serverHooks",0,x,"workAsyncStorage",0,h,"workUnitAsyncStorage",0,f],88607)}];

//# sourceMappingURL=%5Broot-of-the-server%5D__12lvpj0._.js.map