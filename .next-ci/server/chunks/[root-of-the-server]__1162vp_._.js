module.exports=[18622,(e,t,r)=>{t.exports=e.x("next/dist/compiled/next-server/app-page-turbo.runtime.prod.js",()=>require("next/dist/compiled/next-server/app-page-turbo.runtime.prod.js"))},56704,(e,t,r)=>{t.exports=e.x("next/dist/server/app-render/work-async-storage.external.js",()=>require("next/dist/server/app-render/work-async-storage.external.js"))},32319,(e,t,r)=>{t.exports=e.x("next/dist/server/app-render/work-unit-async-storage.external.js",()=>require("next/dist/server/app-render/work-unit-async-storage.external.js"))},24725,(e,t,r)=>{t.exports=e.x("next/dist/server/app-render/after-task-async-storage.external.js",()=>require("next/dist/server/app-render/after-task-async-storage.external.js"))},70406,(e,t,r)=>{t.exports=e.x("next/dist/compiled/@opentelemetry/api",()=>require("next/dist/compiled/@opentelemetry/api"))},93695,(e,t,r)=>{t.exports=e.x("next/dist/shared/lib/no-fallback-error.external.js",()=>require("next/dist/shared/lib/no-fallback-error.external.js"))},66680,(e,t,r)=>{t.exports=e.x("node:crypto",()=>require("node:crypto"))},2157,(e,t,r)=>{t.exports=e.x("node:fs",()=>require("node:fs"))},50227,(e,t,r)=>{t.exports=e.x("node:path",()=>require("node:path"))},43793,e=>{"use strict";let t,r;var a,s=e.x("node:sqlite",()=>require("node:sqlite"),!0),n=e.i(66680),E=e.i(2157),i=e.i(50227);let o=process.env.DATA_DIR||i.default.join(process.cwd(),"data");function T(e,t,r,a){e.prepare(`PRAGMA table_info(${t})`).all().some(e=>e.name===r)||e.exec(`ALTER TABLE ${t} ADD COLUMN ${a}`)}let d=globalThis,u=d.__quarkDb??(E.default.mkdirSync(o,{recursive:!0}),(t=new s.DatabaseSync(i.default.join(o,"quark.db"))).exec("PRAGMA busy_timeout = 5000"),t.exec(`
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
         AND NOT EXISTS (SELECT 1 FROM artifacts a WHERE a.project_id = p.id)`).all(),r=e.prepare("INSERT INTO artifacts (id, project_id, version_id, seq, notes, created_at) VALUES (?, ?, ?, 1, ?, ?)");for(let e of t)r.run(`a_${(0,n.randomBytes)(9).toString("base64url")}`,e.project_id,e.version_id,e.prompt,Date.now())}(t),d.__quarkDb=t);e.s(["db",0,u,"now",0,function(){return Date.now()}])},24361,(e,t,r)=>{t.exports=e.x("util",()=>require("util"))},22734,(e,t,r)=>{t.exports=e.x("fs",()=>require("fs"))},88947,(e,t,r)=>{t.exports=e.x("stream",()=>require("stream"))},6461,(e,t,r)=>{t.exports=e.x("zlib",()=>require("zlib"))},49719,(e,t,r)=>{t.exports=e.x("assert",()=>require("assert"))},874,(e,t,r)=>{t.exports=e.x("buffer",()=>require("buffer"))},68362,e=>{"use strict";var t=e.i(66680),r=e.i(43793);function a(e,a,s){r.db.prepare("UPDATE users SET credits = credits + ? WHERE id = ?").run(a,e),r.db.prepare("INSERT INTO credit_events (id, user_id, delta, reason, created_at) VALUES (?, ?, ?, ?, ?)").run(`ce_${(0,t.randomBytes)(8).toString("base64url")}`,e,a,s,(0,r.now)())}function s(e,t){return!!r.db.prepare("SELECT 1 FROM credit_events WHERE user_id = ? AND reason = ?").get(e,t)}let n={free:0,pro:100,max:400};e.s(["BANNER_BONUS",0,26,"PLANS",0,["free","pro","max"],"SIGNUP_BONUS",0,20,"balance",0,function(e){let t=r.db.prepare("SELECT credits FROM users WHERE id = ?").get(e);return t?.credits??0},"charge",0,function(e,a,s){return 0!==Number(r.db.prepare("UPDATE users SET credits = credits - ? WHERE id = ? AND credits >= ?").run(a,e,a).changes)&&(r.db.prepare("INSERT INTO credit_events (id, user_id, delta, reason, created_at) VALUES (?, ?, ?, ?, ?)").run(`ce_${(0,t.randomBytes)(8).toString("base64url")}`,e,-a,s,(0,r.now)()),!0)},"generationCost",0,function(e,t,r,a=!1){return("deep"===e?5:"mixed"===e?3:1)+ +!!t+ +!!r+2*!!a},"hasClaimed",0,s,"recentEvents",0,function(e,t=20){return r.db.prepare("SELECT delta, reason, created_at FROM credit_events WHERE user_id = ? ORDER BY created_at DESC LIMIT ?").all(e,t).map(e=>({...e}))},"recordEvent",0,a,"redeemCode",0,function(e,t){let s=t.trim().toUpperCase(),n=r.db.prepare("SELECT amount, used_by FROM redeem_codes WHERE code = ?").get(s);return n?n.used_by||0===Number(r.db.prepare("UPDATE redeem_codes SET used_by = ?, used_at = ? WHERE code = ? AND used_by IS NULL").run(e,(0,r.now)(),s).changes)?{ok:!1,error:"该兑换码已被使用"}:(a(e,n.amount,`redeem:${s}`),{ok:!0,amount:n.amount}):{ok:!1,error:"兑换码不存在"}},"switchPlan",0,function(e,t){let E=r.db.prepare("SELECT plan FROM users WHERE id = ?").get(e);if(!E)return{ok:!1,error:"用户不存在"};if(E.plan===t)return{ok:!1,error:"已是当前套餐"};r.db.prepare("UPDATE users SET plan = ? WHERE id = ?").run(t,e);let i=`plan:${t}`;return n[t]>0&&!s(e,i)?(a(e,n[t],i),{ok:!0,bonus:n[t]}):{ok:!0,bonus:0}}])},83159,e=>{"use strict";var t=e.i(43793);let r=new Set(["text/plain","text/markdown","text/csv","application/json"]),a=new Set(["image/png","image/jpeg","image/webp","image/svg+xml"]);function s(e){return r.has(e)?"text":a.has(e)?"image":null}e.s(["attachmentKind",0,s,"inlineImageAssets",0,function(e,t){let r=e;for(let e of t)"image"===e.kind&&e.dataUri&&(r=r.split(`asset://${e.filename}`).join(e.dataUri));return r},"listAttachments",0,function(e){return t.db.prepare("SELECT id, filename, mime, kind, size FROM attachments WHERE project_id = ? ORDER BY created_at").all(e).map(e=>({...e}))},"loadPipelineAttachments",0,function(e){return t.db.prepare("SELECT filename, mime, kind, data FROM attachments WHERE project_id = ? ORDER BY created_at").all(e).map(e=>{let t=Buffer.from(e.data);return"text"===e.kind?{filename:e.filename,kind:e.kind,mime:e.mime,text:t.toString("utf8")}:{filename:e.filename,kind:e.kind,mime:e.mime,dataUri:`data:${e.mime};base64,${t.toString("base64")}`}})},"validateAttachment",0,function(e,t,r){let a=s(e);if(!a)return"仅支持文本(txt/md/csv/json)与图片(png/jpg/webp/svg)";if(r>=6)return"每个项目最多 6 个附件";let n="text"===a?65536:524288;return t>n?`${"text"===a?"文本":"图片"}附件不能超过 ${n/1024}KB`:0===t?"文件为空":null}])},78096,e=>e.a(async(t,r)=>{try{var a=e.i(79832),s=e.i(83555),n=t([s]);async function E(e,t){let r,n=await (0,a.getUser)();if(!n)return Response.json({error:"未登录"},{status:401});let{jobId:E}=await t.params,i=s.jobRunner.getJob(E);if(!i||i.user_id!==n.id)return Response.json({error:"任务不存在"},{status:404});let o=new TextEncoder,T=!1,d=()=>{},u=new ReadableStream({start(e){let t=t=>{if(!T)try{e.enqueue(o.encode(t))}catch{T=!0}},a=e=>t(`data: ${e}

`),n=()=>{T||(t("data: [DONE]\n\n"),T=!0,clearInterval(r),d(),e.close())};if(!s.jobRunner.getLive(E)){a(JSON.stringify({type:"job_state",status:i.status,error:i.error??void 0})),n();return}let u=s.jobRunner.subscribe(E,e=>{if(a(e),e.includes('"job_state"')){let t=JSON.parse(e);"job_state"===t.type&&("done"===t.status||"error"===t.status)&&n()}});for(let e of(d=u.detach,u.replay))a(e);u.done?n():r=setInterval(()=>t(": ping\n\n"),15e3)},cancel(){T=!0,clearInterval(r),d()}});return new Response(u,{headers:{"content-type":"text/event-stream; charset=utf-8","cache-control":"no-cache, no-transform",connection:"keep-alive","x-accel-buffering":"no"}})}[s]=n.then?(await n)():n,e.s(["GET",0,E,"dynamic",0,"force-dynamic"]),r()}catch(e){r(e)}},!1),6888,e=>e.a(async(t,r)=>{try{var a=e.i(47909),s=e.i(74017),n=e.i(96250),E=e.i(59756),i=e.i(61916),o=e.i(74677),T=e.i(69741),d=e.i(16795),u=e.i(87718),p=e.i(95169),N=e.i(47587),c=e.i(66012),l=e.i(70101),L=e.i(26937),R=e.i(10372),_=e.i(93695);e.i(20232);var m=e.i(220),O=e.i(78096),A=t([O]);[O]=A.then?(await A)():A;let S=new a.AppRouteRouteModule({definition:{kind:s.RouteKind.APP_ROUTE,page:"/api/jobs/[jobId]/stream/route",pathname:"/api/jobs/[jobId]/stream",filename:"route",bundlePath:""},distDir:".next-ci",relativeProjectDir:"",resolvedPagePath:"[project]/src/app/api/jobs/[jobId]/stream/route.ts",nextConfigOutput:"",userland:O,...{}}),{workAsyncStorage:U,workUnitAsyncStorage:C,serverHooks:f}=S;async function I(e,t,r){r.requestMeta&&(0,E.setRequestMeta)(e,r.requestMeta),S.isDev&&(0,E.addRequestMeta)(e,"devRequestTimingInternalsEnd",process.hrtime.bigint());let a="/api/jobs/[jobId]/stream/route";a=a.replace(/\/index$/,"")||"/";let n=await S.prepare(e,t,{srcPage:a,multiZoneDraftMode:!1});if(!n)return t.statusCode=400,t.end("Bad Request"),null==r.waitUntil||r.waitUntil.call(r,Promise.resolve()),null;let{buildId:O,deploymentId:A,params:I,nextConfig:U,parsedUrl:C,isDraftMode:f,prerenderManifest:x,routerServerContext:X,isOnDemandRevalidate:h,revalidateOnlyGenerated:v,resolvedPathname:b,clientReferenceManifest:g,serverActionsManifest:j}=n,D=(0,T.normalizeAppPath)(a),w=!!(x.dynamicRoutes[D]||x.routes[b]),F=async()=>((null==X?void 0:X.render404)?await X.render404(e,t,C,!1):t.end("This page could not be found"),null);if(w&&!f){let e=!!x.routes[b],t=x.dynamicRoutes[D];if(t&&!1===t.fallback&&!e){if(U.adapterPath)return await F();throw new _.NoFallbackError}}let y=null;!w||S.isDev||f||(y=b,y="/index"===y?"/":y);let k=!0===S.isDev||!w,P=w&&!k;j&&g&&(0,o.setManifestsSingleton)({page:a,clientReferenceManifest:g,serverActionsManifest:j});let M=e.method||"GET",G=(0,i.getTracer)(),q=G.getActiveScopeSpan(),H=!!(null==X?void 0:X.isWrappedByNextServer),B=!!(0,E.getRequestMeta)(e,"minimalMode"),K=(0,E.getRequestMeta)(e,"incrementalCache")||await S.getIncrementalCache(e,U,x,B);null==K||K.resetRequestCache(),globalThis.__incrementalCache=K;let Y={params:I,previewProps:x.preview,renderOpts:{experimental:{authInterrupts:!!U.experimental.authInterrupts},cacheComponents:!!U.cacheComponents,supportsDynamicResponse:k,incrementalCache:K,cacheLifeProfiles:U.cacheLife,waitUntil:r.waitUntil,onClose:e=>{t.on("close",e)},onAfterTaskError:void 0,onInstrumentationRequestError:(t,r,a,s)=>S.onRequestError(e,t,a,s,X)},sharedContext:{buildId:O,deploymentId:A}},$=new d.NodeNextRequest(e),W=new d.NodeNextResponse(t),Q=u.NextRequestAdapter.fromNodeNextRequest($,(0,u.signalFromNodeResponse)(t));try{let n,E=async e=>S.handle(Q,Y).finally(()=>{if(!e)return;e.setAttributes({"http.status_code":t.statusCode,"next.rsc":!1});let r=G.getRootSpanAttributes();if(!r)return;if(r.get("next.span_type")!==p.BaseServerSpan.handleRequest)return void console.warn(`Unexpected root span type '${r.get("next.span_type")}'. Please report this Next.js issue https://github.com/vercel/next.js`);let s=r.get("next.route");if(s){let t=`${M} ${s}`;e.setAttributes({"next.route":s,"http.route":s,"next.span_name":t}),e.updateName(t),n&&n!==e&&(n.setAttribute("http.route",s),n.updateName(t))}else e.updateName(`${M} ${a}`)}),o=async n=>{var i,o;let T=async({previousCacheEntry:s})=>{try{if(!B&&h&&v&&!s)return t.statusCode=404,t.setHeader("x-nextjs-cache","REVALIDATED"),t.end("This page could not be found"),null;let a=await E(n);e.fetchMetrics=Y.renderOpts.fetchMetrics;let i=Y.renderOpts.pendingWaitUntil;i&&r.waitUntil&&(r.waitUntil(i),i=void 0);let o=Y.renderOpts.collectedTags;if(!w)return await (0,c.sendResponse)($,W,a,Y.renderOpts.pendingWaitUntil),null;{let e=await a.blob(),t=(0,l.toNodeOutgoingHttpHeaders)(a.headers);o&&(t[R.NEXT_CACHE_TAGS_HEADER]=o),!t["content-type"]&&e.type&&(t["content-type"]=e.type);let r=void 0!==Y.renderOpts.collectedRevalidate&&!(Y.renderOpts.collectedRevalidate>=R.INFINITE_CACHE)&&Y.renderOpts.collectedRevalidate,s=void 0===Y.renderOpts.collectedExpire||Y.renderOpts.collectedExpire>=R.INFINITE_CACHE?void 0:Y.renderOpts.collectedExpire;return{value:{kind:m.CachedRouteKind.APP_ROUTE,status:a.status,body:Buffer.from(await e.arrayBuffer()),headers:t},cacheControl:{revalidate:r,expire:s}}}}catch(t){throw(null==s?void 0:s.isStale)&&await S.onRequestError(e,t,{routerKind:"App Router",routePath:a,routeType:"route",revalidateReason:(0,N.getRevalidateReason)({isStaticGeneration:P,isOnDemandRevalidate:h})},!1,X),t}},d=await S.handleResponse({req:e,nextConfig:U,cacheKey:y,routeKind:s.RouteKind.APP_ROUTE,isFallback:!1,prerenderManifest:x,isRoutePPREnabled:!1,isOnDemandRevalidate:h,revalidateOnlyGenerated:v,responseGenerator:T,waitUntil:r.waitUntil,isMinimalMode:B});if(!w)return null;if((null==d||null==(i=d.value)?void 0:i.kind)!==m.CachedRouteKind.APP_ROUTE)throw Object.defineProperty(Error(`Invariant: app-route received invalid cache entry ${null==d||null==(o=d.value)?void 0:o.kind}`),"__NEXT_ERROR_CODE",{value:"E701",enumerable:!1,configurable:!0});B||t.setHeader("x-nextjs-cache",h?"REVALIDATED":d.isMiss?"MISS":d.isStale?"STALE":"HIT"),f&&t.setHeader("Cache-Control","private, no-cache, no-store, max-age=0, must-revalidate");let u=(0,l.fromNodeOutgoingHttpHeaders)(d.value.headers);return B&&w||u.delete(R.NEXT_CACHE_TAGS_HEADER),!d.cacheControl||t.getHeader("Cache-Control")||u.get("Cache-Control")||u.set("Cache-Control",(0,L.getCacheControlHeader)(d.cacheControl)),await (0,c.sendResponse)($,W,new Response(d.value.body,{headers:u,status:d.value.status||200})),null};H&&q?await o(q):(n=G.getActiveScopeSpan(),await G.withPropagatedContext(e.headers,()=>G.trace(p.BaseServerSpan.handleRequest,{spanName:`${M} ${a}`,kind:i.SpanKind.SERVER,attributes:{"http.method":M,"http.target":e.url}},o),void 0,!H))}catch(t){if(t instanceof _.NoFallbackError||await S.onRequestError(e,t,{routerKind:"App Router",routePath:D,routeType:"route",revalidateReason:(0,N.getRevalidateReason)({isStaticGeneration:P,isOnDemandRevalidate:h})},!1,X),w)throw t;return await (0,c.sendResponse)($,W,new Response(null,{status:500})),null}}e.s(["handler",0,I,"patchFetch",0,function(){return(0,n.patchFetch)({workAsyncStorage:U,workUnitAsyncStorage:C})},"routeModule",0,S,"serverHooks",0,f,"workAsyncStorage",0,U,"workUnitAsyncStorage",0,C]),r()}catch(e){r(e)}},!1)];

//# sourceMappingURL=%5Broot-of-the-server%5D__1162vp_._.js.map