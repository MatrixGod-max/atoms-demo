module.exports=[18622,(e,t,r)=>{t.exports=e.x("next/dist/compiled/next-server/app-page-turbo.runtime.prod.js",()=>require("next/dist/compiled/next-server/app-page-turbo.runtime.prod.js"))},56704,(e,t,r)=>{t.exports=e.x("next/dist/server/app-render/work-async-storage.external.js",()=>require("next/dist/server/app-render/work-async-storage.external.js"))},32319,(e,t,r)=>{t.exports=e.x("next/dist/server/app-render/work-unit-async-storage.external.js",()=>require("next/dist/server/app-render/work-unit-async-storage.external.js"))},24725,(e,t,r)=>{t.exports=e.x("next/dist/server/app-render/after-task-async-storage.external.js",()=>require("next/dist/server/app-render/after-task-async-storage.external.js"))},70406,(e,t,r)=>{t.exports=e.x("next/dist/compiled/@opentelemetry/api",()=>require("next/dist/compiled/@opentelemetry/api"))},93695,(e,t,r)=>{t.exports=e.x("next/dist/shared/lib/no-fallback-error.external.js",()=>require("next/dist/shared/lib/no-fallback-error.external.js"))},66680,(e,t,r)=>{t.exports=e.x("node:crypto",()=>require("node:crypto"))},2157,(e,t,r)=>{t.exports=e.x("node:fs",()=>require("node:fs"))},50227,(e,t,r)=>{t.exports=e.x("node:path",()=>require("node:path"))},43793,e=>{"use strict";let t,r;var a,s=e.x("node:sqlite",()=>require("node:sqlite"),!0),n=e.i(66680),E=e.i(2157),i=e.i(50227);let o=process.env.DATA_DIR||i.default.join(process.cwd(),"data");function T(e,t,r,a){e.prepare(`PRAGMA table_info(${t})`).all().some(e=>e.name===r)||e.exec(`ALTER TABLE ${t} ADD COLUMN ${a}`)}let d=globalThis,N=d.__quarkDb??(E.default.mkdirSync(o,{recursive:!0}),(t=new s.DatabaseSync(i.default.join(o,"quark.db"))).exec("PRAGMA busy_timeout = 5000"),t.exec(`
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
  `),T(t,"projects","in_gallery","in_gallery INTEGER NOT NULL DEFAULT 1"),T(t,"projects","platform","platform TEXT NOT NULL DEFAULT 'web' CHECK (platform IN ('web','mobile'))"),T(t,"users","is_demo","is_demo INTEGER NOT NULL DEFAULT 0"),T(t,"jobs","mode","mode TEXT NOT NULL DEFAULT 'fast'"),T(t,"jobs","team","team INTEGER NOT NULL DEFAULT 0"),T(t,"projects","theme","theme TEXT"),T(t,"projects","connectors","connectors TEXT"),T(t,"projects","domain_name","domain_name TEXT"),T(t,"users","credits","credits INTEGER NOT NULL DEFAULT 0"),T(t,"users","plan","plan TEXT NOT NULL DEFAULT 'free'"),T(t,"projects","goal","goal TEXT"),T(t,"projects","goal_active","goal_active INTEGER NOT NULL DEFAULT 0"),T(t,"projects","goal_round","goal_round INTEGER NOT NULL DEFAULT 0"),T(t,"projects","goal_rounds","goal_rounds INTEGER NOT NULL DEFAULT 5"),T(t,"projects","goal_status","goal_status TEXT"),T(t,"projects","acceptance","acceptance TEXT"),T(t,"projects","fused_from","fused_from TEXT"),T(t,"users","username","username TEXT"),r=(a=t).prepare("PRAGMA table_info(users)").all(),r.find(e=>"email"===e.name)?.notnull===1&&(a.exec("PRAGMA foreign_keys = OFF"),a.exec(`
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
         AND NOT EXISTS (SELECT 1 FROM artifacts a WHERE a.project_id = p.id)`).all(),r=e.prepare("INSERT INTO artifacts (id, project_id, version_id, seq, notes, created_at) VALUES (?, ?, ?, 1, ?, ?)");for(let e of t)r.run(`a_${(0,n.randomBytes)(9).toString("base64url")}`,e.project_id,e.version_id,e.prompt,Date.now())}(t),d.__quarkDb=t);e.s(["db",0,N,"now",0,function(){return Date.now()}])},95012,e=>{"use strict";var t=e.i(43793);e.s(["ownedProject",0,function(e,r){return t.db.prepare("SELECT * FROM projects WHERE id = ? AND user_id = ?").get(r,e)}])},83159,e=>{"use strict";var t=e.i(43793);let r=new Set(["text/plain","text/markdown","text/csv","application/json"]),a=new Set(["image/png","image/jpeg","image/webp","image/svg+xml"]);function s(e){return r.has(e)?"text":a.has(e)?"image":null}e.s(["attachmentKind",0,s,"inlineImageAssets",0,function(e,t){let r=e;for(let e of t)"image"===e.kind&&e.dataUri&&(r=r.split(`asset://${e.filename}`).join(e.dataUri));return r},"listAttachments",0,function(e){return t.db.prepare("SELECT id, filename, mime, kind, size FROM attachments WHERE project_id = ? ORDER BY created_at").all(e).map(e=>({...e}))},"loadPipelineAttachments",0,function(e){return t.db.prepare("SELECT filename, mime, kind, data FROM attachments WHERE project_id = ? ORDER BY created_at").all(e).map(e=>{let t=Buffer.from(e.data);return"text"===e.kind?{filename:e.filename,kind:e.kind,mime:e.mime,text:t.toString("utf8")}:{filename:e.filename,kind:e.kind,mime:e.mime,dataUri:`data:${e.mime};base64,${t.toString("base64")}`}})},"validateAttachment",0,function(e,t,r){let a=s(e);if(!a)return"仅支持文本(txt/md/csv/json)与图片(png/jpg/webp/svg)";if(r>=6)return"每个项目最多 6 个附件";let n="text"===a?65536:524288;return t>n?`${"text"===a?"文本":"图片"}附件不能超过 ${n/1024}KB`:0===t?"文件为空":null}])},3448,e=>{"use strict";var t=e.i(47909),r=e.i(74017),a=e.i(96250),s=e.i(59756),n=e.i(61916),E=e.i(74677),i=e.i(69741),o=e.i(16795),T=e.i(87718),d=e.i(95169),N=e.i(47587),p=e.i(66012),l=e.i(70101),c=e.i(26937),u=e.i(10372),L=e.i(93695);e.i(20232);var R=e.i(220),m=e.i(89171),_=e.i(43793),O=e.i(79832),A=e.i(95012),I=e.i(83159);async function U(e,t){let r,a=await (0,O.getUser)();if(!a)return m.NextResponse.json({error:"未登录"},{status:401});let s=(0,O.demoGuard)(a);if(s)return m.NextResponse.json({error:s},{status:403});let{id:n}=await t.params;if(!(0,A.ownedProject)(a.id,n))return m.NextResponse.json({error:"项目不存在"},{status:404});let{filename:E,mime:i,dataBase64:o}=await e.json().catch(()=>({}));if("string"!=typeof E||"string"!=typeof i||"string"!=typeof o)return m.NextResponse.json({error:"参数不完整"},{status:400});try{r=Buffer.from(o,"base64")}catch{return m.NextResponse.json({error:"文件编码无效"},{status:400})}let T=_.db.prepare("SELECT COUNT(*) AS c FROM attachments WHERE project_id = ?").get(n).c,d=(0,I.validateAttachment)(i,r.length,T);if(d)return m.NextResponse.json({error:d},{status:400});let N=(0,O.newId)("att");return _.db.prepare("INSERT INTO attachments (id, project_id, user_id, filename, mime, kind, size, data, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)").run(N,n,a.id,E.slice(0,80),i,(0,I.attachmentKind)(i),r.length,r,(0,_.now)()),m.NextResponse.json({ok:!0,attachments:(0,I.listAttachments)(n)})}e.s(["POST",0,U],75799);var C=e.i(75799);let S=new t.AppRouteRouteModule({definition:{kind:r.RouteKind.APP_ROUTE,page:"/api/projects/[id]/attachments/route",pathname:"/api/projects/[id]/attachments",filename:"route",bundlePath:""},distDir:".next-ci",relativeProjectDir:"",resolvedPagePath:"[project]/src/app/api/projects/[id]/attachments/route.ts",nextConfigOutput:"",userland:C,...{}}),{workAsyncStorage:X,workUnitAsyncStorage:f,serverHooks:h}=S;async function x(e,t,a){a.requestMeta&&(0,s.setRequestMeta)(e,a.requestMeta),S.isDev&&(0,s.addRequestMeta)(e,"devRequestTimingInternalsEnd",process.hrtime.bigint());let m="/api/projects/[id]/attachments/route";m=m.replace(/\/index$/,"")||"/";let _=await S.prepare(e,t,{srcPage:m,multiZoneDraftMode:!1});if(!_)return t.statusCode=400,t.end("Bad Request"),null==a.waitUntil||a.waitUntil.call(a,Promise.resolve()),null;let{buildId:O,deploymentId:A,params:I,nextConfig:U,parsedUrl:C,isDraftMode:X,prerenderManifest:f,routerServerContext:h,isOnDemandRevalidate:x,revalidateOnlyGenerated:v,resolvedPathname:j,clientReferenceManifest:g,serverActionsManifest:D}=_,w=(0,i.normalizeAppPath)(m),F=!!(f.dynamicRoutes[w]||f.routes[j]),b=async()=>((null==h?void 0:h.render404)?await h.render404(e,t,C,!1):t.end("This page could not be found"),null);if(F&&!X){let e=!!f.routes[j],t=f.dynamicRoutes[w];if(t&&!1===t.fallback&&!e){if(U.adapterPath)return await b();throw new L.NoFallbackError}}let y=null;!F||S.isDev||X||(y="/index"===(y=j)?"/":y);let k=!0===S.isDev||!F,P=F&&!k;D&&g&&(0,E.setManifestsSingleton)({page:m,clientReferenceManifest:g,serverActionsManifest:D});let M=e.method||"GET",G=(0,n.getTracer)(),q=G.getActiveScopeSpan(),K=!!(null==h?void 0:h.isWrappedByNextServer),B=!!(0,s.getRequestMeta)(e,"minimalMode"),H=(0,s.getRequestMeta)(e,"incrementalCache")||await S.getIncrementalCache(e,U,f,B);null==H||H.resetRequestCache(),globalThis.__incrementalCache=H;let Y={params:I,previewProps:f.preview,renderOpts:{experimental:{authInterrupts:!!U.experimental.authInterrupts},cacheComponents:!!U.cacheComponents,supportsDynamicResponse:k,incrementalCache:H,cacheLifeProfiles:U.cacheLife,waitUntil:a.waitUntil,onClose:e=>{t.on("close",e)},onAfterTaskError:void 0,onInstrumentationRequestError:(t,r,a,s)=>S.onRequestError(e,t,a,s,h)},sharedContext:{buildId:O,deploymentId:A}},$=new o.NodeNextRequest(e),W=new o.NodeNextResponse(t),Q=T.NextRequestAdapter.fromNodeNextRequest($,(0,T.signalFromNodeResponse)(t));try{let s,E=async e=>S.handle(Q,Y).finally(()=>{if(!e)return;e.setAttributes({"http.status_code":t.statusCode,"next.rsc":!1});let r=G.getRootSpanAttributes();if(!r)return;if(r.get("next.span_type")!==d.BaseServerSpan.handleRequest)return void console.warn(`Unexpected root span type '${r.get("next.span_type")}'. Please report this Next.js issue https://github.com/vercel/next.js`);let a=r.get("next.route");if(a){let t=`${M} ${a}`;e.setAttributes({"next.route":a,"http.route":a,"next.span_name":t}),e.updateName(t),s&&s!==e&&(s.setAttribute("http.route",a),s.updateName(t))}else e.updateName(`${M} ${m}`)}),i=async s=>{var n,i;let o=async({previousCacheEntry:r})=>{try{if(!B&&x&&v&&!r)return t.statusCode=404,t.setHeader("x-nextjs-cache","REVALIDATED"),t.end("This page could not be found"),null;let n=await E(s);e.fetchMetrics=Y.renderOpts.fetchMetrics;let i=Y.renderOpts.pendingWaitUntil;i&&a.waitUntil&&(a.waitUntil(i),i=void 0);let o=Y.renderOpts.collectedTags;if(!F)return await (0,p.sendResponse)($,W,n,Y.renderOpts.pendingWaitUntil),null;{let e=await n.blob(),t=(0,l.toNodeOutgoingHttpHeaders)(n.headers);o&&(t[u.NEXT_CACHE_TAGS_HEADER]=o),!t["content-type"]&&e.type&&(t["content-type"]=e.type);let r=void 0!==Y.renderOpts.collectedRevalidate&&!(Y.renderOpts.collectedRevalidate>=u.INFINITE_CACHE)&&Y.renderOpts.collectedRevalidate,a=void 0===Y.renderOpts.collectedExpire||Y.renderOpts.collectedExpire>=u.INFINITE_CACHE?void 0:Y.renderOpts.collectedExpire;return{value:{kind:R.CachedRouteKind.APP_ROUTE,status:n.status,body:Buffer.from(await e.arrayBuffer()),headers:t},cacheControl:{revalidate:r,expire:a}}}}catch(t){throw(null==r?void 0:r.isStale)&&await S.onRequestError(e,t,{routerKind:"App Router",routePath:m,routeType:"route",revalidateReason:(0,N.getRevalidateReason)({isStaticGeneration:P,isOnDemandRevalidate:x})},!1,h),t}},T=await S.handleResponse({req:e,nextConfig:U,cacheKey:y,routeKind:r.RouteKind.APP_ROUTE,isFallback:!1,prerenderManifest:f,isRoutePPREnabled:!1,isOnDemandRevalidate:x,revalidateOnlyGenerated:v,responseGenerator:o,waitUntil:a.waitUntil,isMinimalMode:B});if(!F)return null;if((null==T||null==(n=T.value)?void 0:n.kind)!==R.CachedRouteKind.APP_ROUTE)throw Object.defineProperty(Error(`Invariant: app-route received invalid cache entry ${null==T||null==(i=T.value)?void 0:i.kind}`),"__NEXT_ERROR_CODE",{value:"E701",enumerable:!1,configurable:!0});B||t.setHeader("x-nextjs-cache",x?"REVALIDATED":T.isMiss?"MISS":T.isStale?"STALE":"HIT"),X&&t.setHeader("Cache-Control","private, no-cache, no-store, max-age=0, must-revalidate");let d=(0,l.fromNodeOutgoingHttpHeaders)(T.value.headers);return B&&F||d.delete(u.NEXT_CACHE_TAGS_HEADER),!T.cacheControl||t.getHeader("Cache-Control")||d.get("Cache-Control")||d.set("Cache-Control",(0,c.getCacheControlHeader)(T.cacheControl)),await (0,p.sendResponse)($,W,new Response(T.value.body,{headers:d,status:T.value.status||200})),null};K&&q?await i(q):(s=G.getActiveScopeSpan(),await G.withPropagatedContext(e.headers,()=>G.trace(d.BaseServerSpan.handleRequest,{spanName:`${M} ${m}`,kind:n.SpanKind.SERVER,attributes:{"http.method":M,"http.target":e.url}},i),void 0,!K))}catch(t){if(t instanceof L.NoFallbackError||await S.onRequestError(e,t,{routerKind:"App Router",routePath:w,routeType:"route",revalidateReason:(0,N.getRevalidateReason)({isStaticGeneration:P,isOnDemandRevalidate:x})},!1,h),F)throw t;return await (0,p.sendResponse)($,W,new Response(null,{status:500})),null}}e.s(["handler",0,x,"patchFetch",0,function(){return(0,a.patchFetch)({workAsyncStorage:X,workUnitAsyncStorage:f})},"routeModule",0,S,"serverHooks",0,h,"workAsyncStorage",0,X,"workUnitAsyncStorage",0,f],3448)}];

//# sourceMappingURL=%5Broot-of-the-server%5D__0z0w_nu._.js.map