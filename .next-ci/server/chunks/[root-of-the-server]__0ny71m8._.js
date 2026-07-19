module.exports=[18622,(e,t,r)=>{t.exports=e.x("next/dist/compiled/next-server/app-page-turbo.runtime.prod.js",()=>require("next/dist/compiled/next-server/app-page-turbo.runtime.prod.js"))},56704,(e,t,r)=>{t.exports=e.x("next/dist/server/app-render/work-async-storage.external.js",()=>require("next/dist/server/app-render/work-async-storage.external.js"))},32319,(e,t,r)=>{t.exports=e.x("next/dist/server/app-render/work-unit-async-storage.external.js",()=>require("next/dist/server/app-render/work-unit-async-storage.external.js"))},24725,(e,t,r)=>{t.exports=e.x("next/dist/server/app-render/after-task-async-storage.external.js",()=>require("next/dist/server/app-render/after-task-async-storage.external.js"))},70406,(e,t,r)=>{t.exports=e.x("next/dist/compiled/@opentelemetry/api",()=>require("next/dist/compiled/@opentelemetry/api"))},93695,(e,t,r)=>{t.exports=e.x("next/dist/shared/lib/no-fallback-error.external.js",()=>require("next/dist/shared/lib/no-fallback-error.external.js"))},66680,(e,t,r)=>{t.exports=e.x("node:crypto",()=>require("node:crypto"))},2157,(e,t,r)=>{t.exports=e.x("node:fs",()=>require("node:fs"))},50227,(e,t,r)=>{t.exports=e.x("node:path",()=>require("node:path"))},43793,e=>{"use strict";let t,r;var s,a=e.x("node:sqlite",()=>require("node:sqlite"),!0),E=e.i(66680),i=e.i(2157),o=e.i(50227);let T=process.env.DATA_DIR||o.default.join(process.cwd(),"data");function n(e,t,r,s){e.prepare(`PRAGMA table_info(${t})`).all().some(e=>e.name===r)||e.exec(`ALTER TABLE ${t} ADD COLUMN ${s}`)}let d=globalThis,N=d.__quarkDb??(i.default.mkdirSync(T,{recursive:!0}),(t=new a.DatabaseSync(o.default.join(T,"quark.db"))).exec("PRAGMA busy_timeout = 5000"),t.exec(`
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
  `),n(t,"projects","in_gallery","in_gallery INTEGER NOT NULL DEFAULT 1"),n(t,"projects","platform","platform TEXT NOT NULL DEFAULT 'web' CHECK (platform IN ('web','mobile'))"),n(t,"users","is_demo","is_demo INTEGER NOT NULL DEFAULT 0"),n(t,"jobs","mode","mode TEXT NOT NULL DEFAULT 'fast'"),n(t,"jobs","team","team INTEGER NOT NULL DEFAULT 0"),n(t,"projects","theme","theme TEXT"),n(t,"projects","connectors","connectors TEXT"),n(t,"projects","domain_name","domain_name TEXT"),n(t,"users","credits","credits INTEGER NOT NULL DEFAULT 0"),n(t,"users","plan","plan TEXT NOT NULL DEFAULT 'free'"),n(t,"projects","goal","goal TEXT"),n(t,"projects","goal_active","goal_active INTEGER NOT NULL DEFAULT 0"),n(t,"projects","goal_round","goal_round INTEGER NOT NULL DEFAULT 0"),n(t,"projects","goal_rounds","goal_rounds INTEGER NOT NULL DEFAULT 5"),n(t,"projects","goal_status","goal_status TEXT"),n(t,"projects","acceptance","acceptance TEXT"),n(t,"projects","fused_from","fused_from TEXT"),n(t,"users","username","username TEXT"),r=(s=t).prepare("PRAGMA table_info(users)").all(),r.find(e=>"email"===e.name)?.notnull===1&&(s.exec("PRAGMA foreign_keys = OFF"),s.exec(`
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
  `),s.exec("PRAGMA foreign_keys = ON")),t.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON users(lower(username)) WHERE username IS NOT NULL"),t.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_projects_domain ON projects(domain_name) WHERE domain_name IS NOT NULL"),t.exec("CREATE INDEX IF NOT EXISTS idx_credit_events_user ON credit_events(user_id, created_at)"),t.exec(`
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
         AND NOT EXISTS (SELECT 1 FROM artifacts a WHERE a.project_id = p.id)`).all(),r=e.prepare("INSERT INTO artifacts (id, project_id, version_id, seq, notes, created_at) VALUES (?, ?, ?, 1, ?, ?)");for(let e of t)r.run(`a_${(0,E.randomBytes)(9).toString("base64url")}`,e.project_id,e.version_id,e.prompt,Date.now())}(t),d.__quarkDb=t);e.s(["db",0,N,"now",0,function(){return Date.now()}])},95012,e=>{"use strict";var t=e.i(43793);e.s(["ownedProject",0,function(e,r){return t.db.prepare("SELECT * FROM projects WHERE id = ? AND user_id = ?").get(r,e)}])},82089,e=>{"use strict";var t=e.i(47909),r=e.i(74017),s=e.i(96250),a=e.i(59756),E=e.i(61916),i=e.i(74677),o=e.i(69741),T=e.i(16795),n=e.i(87718),d=e.i(95169),N=e.i(47587),p=e.i(66012),u=e.i(70101),l=e.i(26937),c=e.i(10372),L=e.i(93695);e.i(20232);var R=e.i(220),_=e.i(66680),O=e.i(89171),A=e.i(43793),I=e.i(79832),U=e.i(95012);async function m(e,t){let r,s=await (0,I.getUser)();if(!s)return O.NextResponse.json({error:"未登录"},{status:401});let a=(0,I.demoGuard)(s);if(a)return O.NextResponse.json({error:a},{status:403});let{id:E}=await t.params,i=(0,U.ownedProject)(s.id,E);if(!i)return O.NextResponse.json({error:"项目不存在"},{status:404});let{action:o,artifactSeq:T}=await e.json().catch(()=>({}));if("unpublish"===o)return A.db.prepare("UPDATE projects SET published_version_id = NULL, updated_at = ? WHERE id = ?").run((0,A.now)(),E),O.NextResponse.json({ok:!0,slug:i.slug});if("set_latest"===o){let e=A.db.prepare("SELECT version_id, seq FROM artifacts WHERE project_id = ? AND seq = ?").get(E,Number(T));return e?(A.db.prepare("UPDATE projects SET published_version_id = ?, updated_at = ? WHERE id = ?").run(e.version_id,(0,A.now)(),E),O.NextResponse.json({ok:!0,slug:i.slug,seq:e.seq})):O.NextResponse.json({error:"制品不存在"},{status:404})}if(!i.current_version_id)return O.NextResponse.json({error:"还没有可发布的版本"},{status:400});let n=i.slug??(0,_.randomBytes)(5).toString("base64url").toLowerCase().replace(/[^a-z0-9]/g,"").slice(0,8).padEnd(6,"0"),d=A.db.prepare("SELECT seq FROM artifacts WHERE project_id = ? AND version_id = ? ORDER BY seq DESC").get(E,i.current_version_id);if(d&&i.published_version_id===i.current_version_id)r=d.seq;else if(d)r=d.seq;else{r=(A.db.prepare("SELECT MAX(seq) AS m FROM artifacts WHERE project_id = ?").get(E).m??0)+1;let e=A.db.prepare("SELECT prompt FROM app_versions WHERE id = ?").get(i.current_version_id);A.db.prepare("INSERT INTO artifacts (id, project_id, version_id, seq, notes, created_at) VALUES (?, ?, ?, ?, ?, ?)").run((0,I.newId)("a"),E,i.current_version_id,r,e?.prompt??null,(0,A.now)())}return A.db.prepare("UPDATE projects SET slug = ?, published_version_id = ?, updated_at = ? WHERE id = ?").run(n,i.current_version_id,(0,A.now)(),E),O.NextResponse.json({ok:!0,slug:n,seq:r})}e.s(["POST",0,m],95103);var C=e.i(95103);let S=new t.AppRouteRouteModule({definition:{kind:r.RouteKind.APP_ROUTE,page:"/api/projects/[id]/publish/route",pathname:"/api/projects/[id]/publish",filename:"route",bundlePath:""},distDir:".next-ci",relativeProjectDir:"",resolvedPagePath:"[project]/src/app/api/projects/[id]/publish/route.ts",nextConfigOutput:"",userland:C,...{}}),{workAsyncStorage:X,workUnitAsyncStorage:v,serverHooks:x}=S;async function h(e,t,s){s.requestMeta&&(0,a.setRequestMeta)(e,s.requestMeta),S.isDev&&(0,a.addRequestMeta)(e,"devRequestTimingInternalsEnd",process.hrtime.bigint());let _="/api/projects/[id]/publish/route";_=_.replace(/\/index$/,"")||"/";let O=await S.prepare(e,t,{srcPage:_,multiZoneDraftMode:!1});if(!O)return t.statusCode=400,t.end("Bad Request"),null==s.waitUntil||s.waitUntil.call(s,Promise.resolve()),null;let{buildId:A,deploymentId:I,params:U,nextConfig:m,parsedUrl:C,isDraftMode:X,prerenderManifest:v,routerServerContext:x,isOnDemandRevalidate:h,revalidateOnlyGenerated:j,resolvedPathname:f,clientReferenceManifest:g,serverActionsManifest:D}=O,b=(0,o.normalizeAppPath)(_),w=!!(v.dynamicRoutes[b]||v.routes[f]),F=async()=>((null==x?void 0:x.render404)?await x.render404(e,t,C,!1):t.end("This page could not be found"),null);if(w&&!X){let e=!!v.routes[f],t=v.dynamicRoutes[b];if(t&&!1===t.fallback&&!e){if(m.adapterPath)return await F();throw new L.NoFallbackError}}let y=null;!w||S.isDev||X||(y="/index"===(y=f)?"/":y);let P=!0===S.isDev||!w,M=w&&!P;D&&g&&(0,i.setManifestsSingleton)({page:_,clientReferenceManifest:g,serverActionsManifest:D});let q=e.method||"GET",G=(0,E.getTracer)(),k=G.getActiveScopeSpan(),H=!!(null==x?void 0:x.isWrappedByNextServer),K=!!(0,a.getRequestMeta)(e,"minimalMode"),Y=(0,a.getRequestMeta)(e,"incrementalCache")||await S.getIncrementalCache(e,m,v,K);null==Y||Y.resetRequestCache(),globalThis.__incrementalCache=Y;let B={params:U,previewProps:v.preview,renderOpts:{experimental:{authInterrupts:!!m.experimental.authInterrupts},cacheComponents:!!m.cacheComponents,supportsDynamicResponse:P,incrementalCache:Y,cacheLifeProfiles:m.cacheLife,waitUntil:s.waitUntil,onClose:e=>{t.on("close",e)},onAfterTaskError:void 0,onInstrumentationRequestError:(t,r,s,a)=>S.onRequestError(e,t,s,a,x)},sharedContext:{buildId:A,deploymentId:I}},W=new T.NodeNextRequest(e),$=new T.NodeNextResponse(t),Q=n.NextRequestAdapter.fromNodeNextRequest(W,(0,n.signalFromNodeResponse)(t));try{let a,i=async e=>S.handle(Q,B).finally(()=>{if(!e)return;e.setAttributes({"http.status_code":t.statusCode,"next.rsc":!1});let r=G.getRootSpanAttributes();if(!r)return;if(r.get("next.span_type")!==d.BaseServerSpan.handleRequest)return void console.warn(`Unexpected root span type '${r.get("next.span_type")}'. Please report this Next.js issue https://github.com/vercel/next.js`);let s=r.get("next.route");if(s){let t=`${q} ${s}`;e.setAttributes({"next.route":s,"http.route":s,"next.span_name":t}),e.updateName(t),a&&a!==e&&(a.setAttribute("http.route",s),a.updateName(t))}else e.updateName(`${q} ${_}`)}),o=async a=>{var E,o;let T=async({previousCacheEntry:r})=>{try{if(!K&&h&&j&&!r)return t.statusCode=404,t.setHeader("x-nextjs-cache","REVALIDATED"),t.end("This page could not be found"),null;let E=await i(a);e.fetchMetrics=B.renderOpts.fetchMetrics;let o=B.renderOpts.pendingWaitUntil;o&&s.waitUntil&&(s.waitUntil(o),o=void 0);let T=B.renderOpts.collectedTags;if(!w)return await (0,p.sendResponse)(W,$,E,B.renderOpts.pendingWaitUntil),null;{let e=await E.blob(),t=(0,u.toNodeOutgoingHttpHeaders)(E.headers);T&&(t[c.NEXT_CACHE_TAGS_HEADER]=T),!t["content-type"]&&e.type&&(t["content-type"]=e.type);let r=void 0!==B.renderOpts.collectedRevalidate&&!(B.renderOpts.collectedRevalidate>=c.INFINITE_CACHE)&&B.renderOpts.collectedRevalidate,s=void 0===B.renderOpts.collectedExpire||B.renderOpts.collectedExpire>=c.INFINITE_CACHE?void 0:B.renderOpts.collectedExpire;return{value:{kind:R.CachedRouteKind.APP_ROUTE,status:E.status,body:Buffer.from(await e.arrayBuffer()),headers:t},cacheControl:{revalidate:r,expire:s}}}}catch(t){throw(null==r?void 0:r.isStale)&&await S.onRequestError(e,t,{routerKind:"App Router",routePath:_,routeType:"route",revalidateReason:(0,N.getRevalidateReason)({isStaticGeneration:M,isOnDemandRevalidate:h})},!1,x),t}},n=await S.handleResponse({req:e,nextConfig:m,cacheKey:y,routeKind:r.RouteKind.APP_ROUTE,isFallback:!1,prerenderManifest:v,isRoutePPREnabled:!1,isOnDemandRevalidate:h,revalidateOnlyGenerated:j,responseGenerator:T,waitUntil:s.waitUntil,isMinimalMode:K});if(!w)return null;if((null==n||null==(E=n.value)?void 0:E.kind)!==R.CachedRouteKind.APP_ROUTE)throw Object.defineProperty(Error(`Invariant: app-route received invalid cache entry ${null==n||null==(o=n.value)?void 0:o.kind}`),"__NEXT_ERROR_CODE",{value:"E701",enumerable:!1,configurable:!0});K||t.setHeader("x-nextjs-cache",h?"REVALIDATED":n.isMiss?"MISS":n.isStale?"STALE":"HIT"),X&&t.setHeader("Cache-Control","private, no-cache, no-store, max-age=0, must-revalidate");let d=(0,u.fromNodeOutgoingHttpHeaders)(n.value.headers);return K&&w||d.delete(c.NEXT_CACHE_TAGS_HEADER),!n.cacheControl||t.getHeader("Cache-Control")||d.get("Cache-Control")||d.set("Cache-Control",(0,l.getCacheControlHeader)(n.cacheControl)),await (0,p.sendResponse)(W,$,new Response(n.value.body,{headers:d,status:n.value.status||200})),null};H&&k?await o(k):(a=G.getActiveScopeSpan(),await G.withPropagatedContext(e.headers,()=>G.trace(d.BaseServerSpan.handleRequest,{spanName:`${q} ${_}`,kind:E.SpanKind.SERVER,attributes:{"http.method":q,"http.target":e.url}},o),void 0,!H))}catch(t){if(t instanceof L.NoFallbackError||await S.onRequestError(e,t,{routerKind:"App Router",routePath:b,routeType:"route",revalidateReason:(0,N.getRevalidateReason)({isStaticGeneration:M,isOnDemandRevalidate:h})},!1,x),w)throw t;return await (0,p.sendResponse)(W,$,new Response(null,{status:500})),null}}e.s(["handler",0,h,"patchFetch",0,function(){return(0,s.patchFetch)({workAsyncStorage:X,workUnitAsyncStorage:v})},"routeModule",0,S,"serverHooks",0,x,"workAsyncStorage",0,X,"workUnitAsyncStorage",0,v],82089)}];

//# sourceMappingURL=%5Broot-of-the-server%5D__0ny71m8._.js.map