module.exports=[66680,(e,t,r)=>{t.exports=e.x("node:crypto",()=>require("node:crypto"))},2157,(e,t,r)=>{t.exports=e.x("node:fs",()=>require("node:fs"))},50227,(e,t,r)=>{t.exports=e.x("node:path",()=>require("node:path"))},18622,(e,t,r)=>{t.exports=e.x("next/dist/compiled/next-server/app-page-turbo.runtime.prod.js",()=>require("next/dist/compiled/next-server/app-page-turbo.runtime.prod.js"))},56704,(e,t,r)=>{t.exports=e.x("next/dist/server/app-render/work-async-storage.external.js",()=>require("next/dist/server/app-render/work-async-storage.external.js"))},32319,(e,t,r)=>{t.exports=e.x("next/dist/server/app-render/work-unit-async-storage.external.js",()=>require("next/dist/server/app-render/work-unit-async-storage.external.js"))},70406,(e,t,r)=>{t.exports=e.x("next/dist/compiled/@opentelemetry/api",()=>require("next/dist/compiled/@opentelemetry/api"))},93695,(e,t,r)=>{t.exports=e.x("next/dist/shared/lib/no-fallback-error.external.js",()=>require("next/dist/shared/lib/no-fallback-error.external.js"))},43793,e=>{"use strict";let t,r;var a,s=e.x("node:sqlite",()=>require("node:sqlite"),!0),E=e.i(66680),T=e.i(2157),i=e.i(50227);let o=process.env.DATA_DIR||i.default.join(process.cwd(),"data");function n(e,t,r,a){e.prepare(`PRAGMA table_info(${t})`).all().some(e=>e.name===r)||e.exec(`ALTER TABLE ${t} ADD COLUMN ${a}`)}let d=globalThis,N=d.__quarkDb??(T.default.mkdirSync(o,{recursive:!0}),(t=new s.DatabaseSync(i.default.join(o,"quark.db"))).exec("PRAGMA busy_timeout = 5000"),t.exec(`
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
  `),n(t,"projects","in_gallery","in_gallery INTEGER NOT NULL DEFAULT 1"),n(t,"projects","platform","platform TEXT NOT NULL DEFAULT 'web' CHECK (platform IN ('web','mobile'))"),n(t,"users","is_demo","is_demo INTEGER NOT NULL DEFAULT 0"),n(t,"jobs","mode","mode TEXT NOT NULL DEFAULT 'fast'"),n(t,"jobs","team","team INTEGER NOT NULL DEFAULT 0"),n(t,"projects","theme","theme TEXT"),n(t,"projects","connectors","connectors TEXT"),n(t,"projects","domain_name","domain_name TEXT"),n(t,"users","credits","credits INTEGER NOT NULL DEFAULT 0"),n(t,"users","plan","plan TEXT NOT NULL DEFAULT 'free'"),n(t,"projects","goal","goal TEXT"),n(t,"projects","goal_active","goal_active INTEGER NOT NULL DEFAULT 0"),n(t,"projects","goal_round","goal_round INTEGER NOT NULL DEFAULT 0"),n(t,"projects","goal_rounds","goal_rounds INTEGER NOT NULL DEFAULT 5"),n(t,"projects","goal_status","goal_status TEXT"),n(t,"projects","acceptance","acceptance TEXT"),n(t,"projects","fused_from","fused_from TEXT"),n(t,"users","username","username TEXT"),r=(a=t).prepare("PRAGMA table_info(users)").all(),r.find(e=>"email"===e.name)?.notnull===1&&(a.exec("PRAGMA foreign_keys = OFF"),a.exec(`
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
         AND NOT EXISTS (SELECT 1 FROM artifacts a WHERE a.project_id = p.id)`).all(),r=e.prepare("INSERT INTO artifacts (id, project_id, version_id, seq, notes, created_at) VALUES (?, ?, ?, 1, ?, ?)");for(let e of t)r.run(`a_${(0,E.randomBytes)(9).toString("base64url")}`,e.project_id,e.version_id,e.prompt,Date.now())}(t),d.__quarkDb=t);e.s(["db",0,N,"now",0,function(){return Date.now()}])},64458,e=>{"use strict";var t=e.i(47909),r=e.i(74017),a=e.i(96250),s=e.i(59756),E=e.i(61916),T=e.i(74677),i=e.i(69741),o=e.i(16795),n=e.i(87718),d=e.i(95169),N=e.i(47587),p=e.i(66012),l=e.i(70101),c=e.i(26937),u=e.i(10372),L=e.i(93695);e.i(20232);var R=e.i(220),_=e.i(43793);async function O(e,t){let{slug:r}=await t.params,a=_.db.prepare("SELECT name FROM projects WHERE slug = ? AND published_version_id IS NOT NULL").get(r);return a?new Response(JSON.stringify({id:`/${r}`,name:a.name,short_name:a.name.slice(0,12),start_url:`/${r}`,scope:`/${r}`,display:"standalone",background_color:"#0d0e1c",theme_color:"#0d0e1c",icons:[{src:`/api/apps/${r}/icon.svg`,sizes:"any",type:"image/svg+xml",purpose:"any"},{src:`/api/apps/${r}/icon.svg`,sizes:"512x512",type:"image/svg+xml",purpose:"maskable"}]}),{headers:{"content-type":"application/manifest+json; charset=utf-8","cache-control":"no-cache"}}):Response.json({error:"not found"},{status:404})}e.s(["GET",0,O,"dynamic",0,"force-dynamic"],48105);var A=e.i(48105);let I=new t.AppRouteRouteModule({definition:{kind:r.RouteKind.APP_ROUTE,page:"/api/apps/[slug]/manifest.webmanifest/route",pathname:"/api/apps/[slug]/manifest.webmanifest",filename:"route",bundlePath:""},distDir:".next-ci",relativeProjectDir:"",resolvedPagePath:"[project]/src/app/api/apps/[slug]/manifest.webmanifest/route.ts",nextConfigOutput:"",userland:A,...{}}),{workAsyncStorage:m,workUnitAsyncStorage:U,serverHooks:C}=I;async function X(e,t,a){a.requestMeta&&(0,s.setRequestMeta)(e,a.requestMeta),I.isDev&&(0,s.addRequestMeta)(e,"devRequestTimingInternalsEnd",process.hrtime.bigint());let _="/api/apps/[slug]/manifest.webmanifest/route";_=_.replace(/\/index$/,"")||"/";let O=await I.prepare(e,t,{srcPage:_,multiZoneDraftMode:!1});if(!O)return t.statusCode=400,t.end("Bad Request"),null==a.waitUntil||a.waitUntil.call(a,Promise.resolve()),null;let{buildId:A,deploymentId:m,params:U,nextConfig:C,parsedUrl:X,isDraftMode:S,prerenderManifest:h,routerServerContext:v,isOnDemandRevalidate:x,revalidateOnlyGenerated:f,resolvedPathname:g,clientReferenceManifest:j,serverActionsManifest:D}=O,b=(0,i.normalizeAppPath)(_),F=!!(h.dynamicRoutes[b]||h.routes[g]),w=async()=>((null==v?void 0:v.render404)?await v.render404(e,t,X,!1):t.end("This page could not be found"),null);if(F&&!S){let e=!!h.routes[g],t=h.dynamicRoutes[b];if(t&&!1===t.fallback&&!e){if(C.adapterPath)return await w();throw new L.NoFallbackError}}let y=null;!F||I.isDev||S||(y="/index"===(y=g)?"/":y);let G=!0===I.isDev||!F,P=F&&!G;D&&j&&(0,T.setManifestsSingleton)({page:_,clientReferenceManifest:j,serverActionsManifest:D});let M=e.method||"GET",k=(0,E.getTracer)(),q=k.getActiveScopeSpan(),K=!!(null==v?void 0:v.isWrappedByNextServer),H=!!(0,s.getRequestMeta)(e,"minimalMode"),Y=(0,s.getRequestMeta)(e,"incrementalCache")||await I.getIncrementalCache(e,C,h,H);null==Y||Y.resetRequestCache(),globalThis.__incrementalCache=Y;let B={params:U,previewProps:h.preview,renderOpts:{experimental:{authInterrupts:!!C.experimental.authInterrupts},cacheComponents:!!C.cacheComponents,supportsDynamicResponse:G,incrementalCache:Y,cacheLifeProfiles:C.cacheLife,waitUntil:a.waitUntil,onClose:e=>{t.on("close",e)},onAfterTaskError:void 0,onInstrumentationRequestError:(t,r,a,s)=>I.onRequestError(e,t,a,s,v)},sharedContext:{buildId:A,deploymentId:m}},$=new o.NodeNextRequest(e),W=new o.NodeNextResponse(t),Q=n.NextRequestAdapter.fromNodeNextRequest($,(0,n.signalFromNodeResponse)(t));try{let s,T=async e=>I.handle(Q,B).finally(()=>{if(!e)return;e.setAttributes({"http.status_code":t.statusCode,"next.rsc":!1});let r=k.getRootSpanAttributes();if(!r)return;if(r.get("next.span_type")!==d.BaseServerSpan.handleRequest)return void console.warn(`Unexpected root span type '${r.get("next.span_type")}'. Please report this Next.js issue https://github.com/vercel/next.js`);let a=r.get("next.route");if(a){let t=`${M} ${a}`;e.setAttributes({"next.route":a,"http.route":a,"next.span_name":t}),e.updateName(t),s&&s!==e&&(s.setAttribute("http.route",a),s.updateName(t))}else e.updateName(`${M} ${_}`)}),i=async s=>{var E,i;let o=async({previousCacheEntry:r})=>{try{if(!H&&x&&f&&!r)return t.statusCode=404,t.setHeader("x-nextjs-cache","REVALIDATED"),t.end("This page could not be found"),null;let E=await T(s);e.fetchMetrics=B.renderOpts.fetchMetrics;let i=B.renderOpts.pendingWaitUntil;i&&a.waitUntil&&(a.waitUntil(i),i=void 0);let o=B.renderOpts.collectedTags;if(!F)return await (0,p.sendResponse)($,W,E,B.renderOpts.pendingWaitUntil),null;{let e=await E.blob(),t=(0,l.toNodeOutgoingHttpHeaders)(E.headers);o&&(t[u.NEXT_CACHE_TAGS_HEADER]=o),!t["content-type"]&&e.type&&(t["content-type"]=e.type);let r=void 0!==B.renderOpts.collectedRevalidate&&!(B.renderOpts.collectedRevalidate>=u.INFINITE_CACHE)&&B.renderOpts.collectedRevalidate,a=void 0===B.renderOpts.collectedExpire||B.renderOpts.collectedExpire>=u.INFINITE_CACHE?void 0:B.renderOpts.collectedExpire;return{value:{kind:R.CachedRouteKind.APP_ROUTE,status:E.status,body:Buffer.from(await e.arrayBuffer()),headers:t},cacheControl:{revalidate:r,expire:a}}}}catch(t){throw(null==r?void 0:r.isStale)&&await I.onRequestError(e,t,{routerKind:"App Router",routePath:_,routeType:"route",revalidateReason:(0,N.getRevalidateReason)({isStaticGeneration:P,isOnDemandRevalidate:x})},!1,v),t}},n=await I.handleResponse({req:e,nextConfig:C,cacheKey:y,routeKind:r.RouteKind.APP_ROUTE,isFallback:!1,prerenderManifest:h,isRoutePPREnabled:!1,isOnDemandRevalidate:x,revalidateOnlyGenerated:f,responseGenerator:o,waitUntil:a.waitUntil,isMinimalMode:H});if(!F)return null;if((null==n||null==(E=n.value)?void 0:E.kind)!==R.CachedRouteKind.APP_ROUTE)throw Object.defineProperty(Error(`Invariant: app-route received invalid cache entry ${null==n||null==(i=n.value)?void 0:i.kind}`),"__NEXT_ERROR_CODE",{value:"E701",enumerable:!1,configurable:!0});H||t.setHeader("x-nextjs-cache",x?"REVALIDATED":n.isMiss?"MISS":n.isStale?"STALE":"HIT"),S&&t.setHeader("Cache-Control","private, no-cache, no-store, max-age=0, must-revalidate");let d=(0,l.fromNodeOutgoingHttpHeaders)(n.value.headers);return H&&F||d.delete(u.NEXT_CACHE_TAGS_HEADER),!n.cacheControl||t.getHeader("Cache-Control")||d.get("Cache-Control")||d.set("Cache-Control",(0,c.getCacheControlHeader)(n.cacheControl)),await (0,p.sendResponse)($,W,new Response(n.value.body,{headers:d,status:n.value.status||200})),null};K&&q?await i(q):(s=k.getActiveScopeSpan(),await k.withPropagatedContext(e.headers,()=>k.trace(d.BaseServerSpan.handleRequest,{spanName:`${M} ${_}`,kind:E.SpanKind.SERVER,attributes:{"http.method":M,"http.target":e.url}},i),void 0,!K))}catch(t){if(t instanceof L.NoFallbackError||await I.onRequestError(e,t,{routerKind:"App Router",routePath:b,routeType:"route",revalidateReason:(0,N.getRevalidateReason)({isStaticGeneration:P,isOnDemandRevalidate:x})},!1,v),F)throw t;return await (0,p.sendResponse)($,W,new Response(null,{status:500})),null}}e.s(["handler",0,X,"patchFetch",0,function(){return(0,a.patchFetch)({workAsyncStorage:m,workUnitAsyncStorage:U})},"routeModule",0,I,"serverHooks",0,C,"workAsyncStorage",0,m,"workUnitAsyncStorage",0,U],64458)}];

//# sourceMappingURL=%5Broot-of-the-server%5D__100ottd._.js.map