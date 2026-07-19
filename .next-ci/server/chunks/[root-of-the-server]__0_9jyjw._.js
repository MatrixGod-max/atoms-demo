module.exports=[18622,(e,t,r)=>{t.exports=e.x("next/dist/compiled/next-server/app-page-turbo.runtime.prod.js",()=>require("next/dist/compiled/next-server/app-page-turbo.runtime.prod.js"))},56704,(e,t,r)=>{t.exports=e.x("next/dist/server/app-render/work-async-storage.external.js",()=>require("next/dist/server/app-render/work-async-storage.external.js"))},32319,(e,t,r)=>{t.exports=e.x("next/dist/server/app-render/work-unit-async-storage.external.js",()=>require("next/dist/server/app-render/work-unit-async-storage.external.js"))},24725,(e,t,r)=>{t.exports=e.x("next/dist/server/app-render/after-task-async-storage.external.js",()=>require("next/dist/server/app-render/after-task-async-storage.external.js"))},70406,(e,t,r)=>{t.exports=e.x("next/dist/compiled/@opentelemetry/api",()=>require("next/dist/compiled/@opentelemetry/api"))},93695,(e,t,r)=>{t.exports=e.x("next/dist/shared/lib/no-fallback-error.external.js",()=>require("next/dist/shared/lib/no-fallback-error.external.js"))},66680,(e,t,r)=>{t.exports=e.x("node:crypto",()=>require("node:crypto"))},2157,(e,t,r)=>{t.exports=e.x("node:fs",()=>require("node:fs"))},50227,(e,t,r)=>{t.exports=e.x("node:path",()=>require("node:path"))},43793,e=>{"use strict";let t,r;var a,s=e.x("node:sqlite",()=>require("node:sqlite"),!0),E=e.i(66680),n=e.i(2157),o=e.i(50227);let T=process.env.DATA_DIR||o.default.join(process.cwd(),"data");function i(e,t,r,a){e.prepare(`PRAGMA table_info(${t})`).all().some(e=>e.name===r)||e.exec(`ALTER TABLE ${t} ADD COLUMN ${a}`)}let d=globalThis,N=d.__quarkDb??(n.default.mkdirSync(T,{recursive:!0}),(t=new s.DatabaseSync(o.default.join(T,"quark.db"))).exec("PRAGMA busy_timeout = 5000"),t.exec(`
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
         AND NOT EXISTS (SELECT 1 FROM artifacts a WHERE a.project_id = p.id)`).all(),r=e.prepare("INSERT INTO artifacts (id, project_id, version_id, seq, notes, created_at) VALUES (?, ?, ?, 1, ?, ?)");for(let e of t)r.run(`a_${(0,E.randomBytes)(9).toString("base64url")}`,e.project_id,e.version_id,e.prompt,Date.now())}(t),d.__quarkDb=t);e.s(["db",0,N,"now",0,function(){return Date.now()}])},68362,e=>{"use strict";var t=e.i(66680),r=e.i(43793);function a(e,a,s){r.db.prepare("UPDATE users SET credits = credits + ? WHERE id = ?").run(a,e),r.db.prepare("INSERT INTO credit_events (id, user_id, delta, reason, created_at) VALUES (?, ?, ?, ?, ?)").run(`ce_${(0,t.randomBytes)(8).toString("base64url")}`,e,a,s,(0,r.now)())}function s(e,t){return!!r.db.prepare("SELECT 1 FROM credit_events WHERE user_id = ? AND reason = ?").get(e,t)}let E={free:0,pro:100,max:400};e.s(["BANNER_BONUS",0,26,"PLANS",0,["free","pro","max"],"SIGNUP_BONUS",0,20,"balance",0,function(e){let t=r.db.prepare("SELECT credits FROM users WHERE id = ?").get(e);return t?.credits??0},"charge",0,function(e,a,s){return 0!==Number(r.db.prepare("UPDATE users SET credits = credits - ? WHERE id = ? AND credits >= ?").run(a,e,a).changes)&&(r.db.prepare("INSERT INTO credit_events (id, user_id, delta, reason, created_at) VALUES (?, ?, ?, ?, ?)").run(`ce_${(0,t.randomBytes)(8).toString("base64url")}`,e,-a,s,(0,r.now)()),!0)},"generationCost",0,function(e,t,r,a=!1){return("deep"===e?5:"mixed"===e?3:1)+ +!!t+ +!!r+2*!!a},"hasClaimed",0,s,"recentEvents",0,function(e,t=20){return r.db.prepare("SELECT delta, reason, created_at FROM credit_events WHERE user_id = ? ORDER BY created_at DESC LIMIT ?").all(e,t).map(e=>({...e}))},"recordEvent",0,a,"redeemCode",0,function(e,t){let s=t.trim().toUpperCase(),E=r.db.prepare("SELECT amount, used_by FROM redeem_codes WHERE code = ?").get(s);return E?E.used_by||0===Number(r.db.prepare("UPDATE redeem_codes SET used_by = ?, used_at = ? WHERE code = ? AND used_by IS NULL").run(e,(0,r.now)(),s).changes)?{ok:!1,error:"该兑换码已被使用"}:(a(e,E.amount,`redeem:${s}`),{ok:!0,amount:E.amount}):{ok:!1,error:"兑换码不存在"}},"switchPlan",0,function(e,t){let n=r.db.prepare("SELECT plan FROM users WHERE id = ?").get(e);if(!n)return{ok:!1,error:"用户不存在"};if(n.plan===t)return{ok:!1,error:"已是当前套餐"};r.db.prepare("UPDATE users SET plan = ? WHERE id = ?").run(t,e);let o=`plan:${t}`;return E[t]>0&&!s(e,o)?(a(e,E[t],o),{ok:!0,bonus:E[t]}):{ok:!0,bonus:0}}])},53765,e=>{"use strict";var t=e.i(47909),r=e.i(74017),a=e.i(96250),s=e.i(59756),E=e.i(61916),n=e.i(74677),o=e.i(69741),T=e.i(16795),i=e.i(87718),d=e.i(95169),N=e.i(47587),p=e.i(66012),u=e.i(70101),c=e.i(26937),l=e.i(10372),L=e.i(93695);e.i(20232);var R=e.i(220),_=e.i(89171),O=e.i(79832),A=e.i(68362);async function I(e){let t=await (0,O.getUser)();if(!t)return _.NextResponse.json({error:"未登录"},{status:401});let r=(0,O.demoGuard)(t);if(r)return _.NextResponse.json({error:r},{status:403});let{plan:a}=await e.json().catch(()=>({}));if("string"!=typeof a||!A.PLANS.includes(a))return _.NextResponse.json({error:"无效的套餐"},{status:400});let s=(0,A.switchPlan)(t.id,a);return s.ok?_.NextResponse.json({ok:!0,plan:a,bonus:s.bonus,credits:(0,A.balance)(t.id)}):_.NextResponse.json({error:s.error},{status:400})}e.s(["POST",0,I,"dynamic",0,"force-dynamic"],24098);var m=e.i(24098);let U=new t.AppRouteRouteModule({definition:{kind:r.RouteKind.APP_ROUTE,page:"/api/plan/route",pathname:"/api/plan",filename:"route",bundlePath:""},distDir:".next-ci",relativeProjectDir:"",resolvedPagePath:"[project]/src/app/api/plan/route.ts",nextConfigOutput:"",userland:m,...{}}),{workAsyncStorage:S,workUnitAsyncStorage:C,serverHooks:X}=U;async function x(e,t,a){a.requestMeta&&(0,s.setRequestMeta)(e,a.requestMeta),U.isDev&&(0,s.addRequestMeta)(e,"devRequestTimingInternalsEnd",process.hrtime.bigint());let _="/api/plan/route";_=_.replace(/\/index$/,"")||"/";let O=await U.prepare(e,t,{srcPage:_,multiZoneDraftMode:!1});if(!O)return t.statusCode=400,t.end("Bad Request"),null==a.waitUntil||a.waitUntil.call(a,Promise.resolve()),null;let{buildId:A,deploymentId:I,params:m,nextConfig:S,parsedUrl:C,isDraftMode:X,prerenderManifest:x,routerServerContext:v,isOnDemandRevalidate:h,revalidateOnlyGenerated:f,resolvedPathname:g,clientReferenceManifest:b,serverActionsManifest:D}=O,j=(0,o.normalizeAppPath)(_),F=!!(x.dynamicRoutes[j]||x.routes[g]),w=async()=>((null==v?void 0:v.render404)?await v.render404(e,t,C,!1):t.end("This page could not be found"),null);if(F&&!X){let e=!!x.routes[g],t=x.dynamicRoutes[j];if(t&&!1===t.fallback&&!e){if(S.adapterPath)return await w();throw new L.NoFallbackError}}let y=null;!F||U.isDev||X||(y="/index"===(y=g)?"/":y);let P=!0===U.isDev||!F,M=F&&!P;D&&b&&(0,n.setManifestsSingleton)({page:_,clientReferenceManifest:b,serverActionsManifest:D});let k=e.method||"GET",G=(0,E.getTracer)(),q=G.getActiveScopeSpan(),H=!!(null==v?void 0:v.isWrappedByNextServer),B=!!(0,s.getRequestMeta)(e,"minimalMode"),K=(0,s.getRequestMeta)(e,"incrementalCache")||await U.getIncrementalCache(e,S,x,B);null==K||K.resetRequestCache(),globalThis.__incrementalCache=K;let Y={params:m,previewProps:x.preview,renderOpts:{experimental:{authInterrupts:!!S.experimental.authInterrupts},cacheComponents:!!S.cacheComponents,supportsDynamicResponse:P,incrementalCache:K,cacheLifeProfiles:S.cacheLife,waitUntil:a.waitUntil,onClose:e=>{t.on("close",e)},onAfterTaskError:void 0,onInstrumentationRequestError:(t,r,a,s)=>U.onRequestError(e,t,a,s,v)},sharedContext:{buildId:A,deploymentId:I}},W=new T.NodeNextRequest(e),$=new T.NodeNextResponse(t),Q=i.NextRequestAdapter.fromNodeNextRequest(W,(0,i.signalFromNodeResponse)(t));try{let s,n=async e=>U.handle(Q,Y).finally(()=>{if(!e)return;e.setAttributes({"http.status_code":t.statusCode,"next.rsc":!1});let r=G.getRootSpanAttributes();if(!r)return;if(r.get("next.span_type")!==d.BaseServerSpan.handleRequest)return void console.warn(`Unexpected root span type '${r.get("next.span_type")}'. Please report this Next.js issue https://github.com/vercel/next.js`);let a=r.get("next.route");if(a){let t=`${k} ${a}`;e.setAttributes({"next.route":a,"http.route":a,"next.span_name":t}),e.updateName(t),s&&s!==e&&(s.setAttribute("http.route",a),s.updateName(t))}else e.updateName(`${k} ${_}`)}),o=async s=>{var E,o;let T=async({previousCacheEntry:r})=>{try{if(!B&&h&&f&&!r)return t.statusCode=404,t.setHeader("x-nextjs-cache","REVALIDATED"),t.end("This page could not be found"),null;let E=await n(s);e.fetchMetrics=Y.renderOpts.fetchMetrics;let o=Y.renderOpts.pendingWaitUntil;o&&a.waitUntil&&(a.waitUntil(o),o=void 0);let T=Y.renderOpts.collectedTags;if(!F)return await (0,p.sendResponse)(W,$,E,Y.renderOpts.pendingWaitUntil),null;{let e=await E.blob(),t=(0,u.toNodeOutgoingHttpHeaders)(E.headers);T&&(t[l.NEXT_CACHE_TAGS_HEADER]=T),!t["content-type"]&&e.type&&(t["content-type"]=e.type);let r=void 0!==Y.renderOpts.collectedRevalidate&&!(Y.renderOpts.collectedRevalidate>=l.INFINITE_CACHE)&&Y.renderOpts.collectedRevalidate,a=void 0===Y.renderOpts.collectedExpire||Y.renderOpts.collectedExpire>=l.INFINITE_CACHE?void 0:Y.renderOpts.collectedExpire;return{value:{kind:R.CachedRouteKind.APP_ROUTE,status:E.status,body:Buffer.from(await e.arrayBuffer()),headers:t},cacheControl:{revalidate:r,expire:a}}}}catch(t){throw(null==r?void 0:r.isStale)&&await U.onRequestError(e,t,{routerKind:"App Router",routePath:_,routeType:"route",revalidateReason:(0,N.getRevalidateReason)({isStaticGeneration:M,isOnDemandRevalidate:h})},!1,v),t}},i=await U.handleResponse({req:e,nextConfig:S,cacheKey:y,routeKind:r.RouteKind.APP_ROUTE,isFallback:!1,prerenderManifest:x,isRoutePPREnabled:!1,isOnDemandRevalidate:h,revalidateOnlyGenerated:f,responseGenerator:T,waitUntil:a.waitUntil,isMinimalMode:B});if(!F)return null;if((null==i||null==(E=i.value)?void 0:E.kind)!==R.CachedRouteKind.APP_ROUTE)throw Object.defineProperty(Error(`Invariant: app-route received invalid cache entry ${null==i||null==(o=i.value)?void 0:o.kind}`),"__NEXT_ERROR_CODE",{value:"E701",enumerable:!1,configurable:!0});B||t.setHeader("x-nextjs-cache",h?"REVALIDATED":i.isMiss?"MISS":i.isStale?"STALE":"HIT"),X&&t.setHeader("Cache-Control","private, no-cache, no-store, max-age=0, must-revalidate");let d=(0,u.fromNodeOutgoingHttpHeaders)(i.value.headers);return B&&F||d.delete(l.NEXT_CACHE_TAGS_HEADER),!i.cacheControl||t.getHeader("Cache-Control")||d.get("Cache-Control")||d.set("Cache-Control",(0,c.getCacheControlHeader)(i.cacheControl)),await (0,p.sendResponse)(W,$,new Response(i.value.body,{headers:d,status:i.value.status||200})),null};H&&q?await o(q):(s=G.getActiveScopeSpan(),await G.withPropagatedContext(e.headers,()=>G.trace(d.BaseServerSpan.handleRequest,{spanName:`${k} ${_}`,kind:E.SpanKind.SERVER,attributes:{"http.method":k,"http.target":e.url}},o),void 0,!H))}catch(t){if(t instanceof L.NoFallbackError||await U.onRequestError(e,t,{routerKind:"App Router",routePath:j,routeType:"route",revalidateReason:(0,N.getRevalidateReason)({isStaticGeneration:M,isOnDemandRevalidate:h})},!1,v),F)throw t;return await (0,p.sendResponse)(W,$,new Response(null,{status:500})),null}}e.s(["handler",0,x,"patchFetch",0,function(){return(0,a.patchFetch)({workAsyncStorage:S,workUnitAsyncStorage:C})},"routeModule",0,U,"serverHooks",0,X,"workAsyncStorage",0,S,"workUnitAsyncStorage",0,C],53765)}];

//# sourceMappingURL=%5Broot-of-the-server%5D__0_9jyjw._.js.map