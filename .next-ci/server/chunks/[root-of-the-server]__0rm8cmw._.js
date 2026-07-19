module.exports=[18622,(e,t,r)=>{t.exports=e.x("next/dist/compiled/next-server/app-page-turbo.runtime.prod.js",()=>require("next/dist/compiled/next-server/app-page-turbo.runtime.prod.js"))},56704,(e,t,r)=>{t.exports=e.x("next/dist/server/app-render/work-async-storage.external.js",()=>require("next/dist/server/app-render/work-async-storage.external.js"))},32319,(e,t,r)=>{t.exports=e.x("next/dist/server/app-render/work-unit-async-storage.external.js",()=>require("next/dist/server/app-render/work-unit-async-storage.external.js"))},24725,(e,t,r)=>{t.exports=e.x("next/dist/server/app-render/after-task-async-storage.external.js",()=>require("next/dist/server/app-render/after-task-async-storage.external.js"))},70406,(e,t,r)=>{t.exports=e.x("next/dist/compiled/@opentelemetry/api",()=>require("next/dist/compiled/@opentelemetry/api"))},93695,(e,t,r)=>{t.exports=e.x("next/dist/shared/lib/no-fallback-error.external.js",()=>require("next/dist/shared/lib/no-fallback-error.external.js"))},66680,(e,t,r)=>{t.exports=e.x("node:crypto",()=>require("node:crypto"))},2157,(e,t,r)=>{t.exports=e.x("node:fs",()=>require("node:fs"))},50227,(e,t,r)=>{t.exports=e.x("node:path",()=>require("node:path"))},43793,e=>{"use strict";let t,r;var s,a=e.x("node:sqlite",()=>require("node:sqlite"),!0),E=e.i(66680),n=e.i(2157),o=e.i(50227);let i=process.env.DATA_DIR||o.default.join(process.cwd(),"data");function T(e,t,r,s){e.prepare(`PRAGMA table_info(${t})`).all().some(e=>e.name===r)||e.exec(`ALTER TABLE ${t} ADD COLUMN ${s}`)}let d=globalThis,N=d.__quarkDb??(n.default.mkdirSync(i,{recursive:!0}),(t=new a.DatabaseSync(o.default.join(i,"quark.db"))).exec("PRAGMA busy_timeout = 5000"),t.exec(`
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
  `),T(t,"projects","in_gallery","in_gallery INTEGER NOT NULL DEFAULT 1"),T(t,"projects","platform","platform TEXT NOT NULL DEFAULT 'web' CHECK (platform IN ('web','mobile'))"),T(t,"users","is_demo","is_demo INTEGER NOT NULL DEFAULT 0"),T(t,"jobs","mode","mode TEXT NOT NULL DEFAULT 'fast'"),T(t,"jobs","team","team INTEGER NOT NULL DEFAULT 0"),T(t,"projects","theme","theme TEXT"),T(t,"projects","connectors","connectors TEXT"),T(t,"projects","domain_name","domain_name TEXT"),T(t,"users","credits","credits INTEGER NOT NULL DEFAULT 0"),T(t,"users","plan","plan TEXT NOT NULL DEFAULT 'free'"),T(t,"projects","goal","goal TEXT"),T(t,"projects","goal_active","goal_active INTEGER NOT NULL DEFAULT 0"),T(t,"projects","goal_round","goal_round INTEGER NOT NULL DEFAULT 0"),T(t,"projects","goal_rounds","goal_rounds INTEGER NOT NULL DEFAULT 5"),T(t,"projects","goal_status","goal_status TEXT"),T(t,"projects","acceptance","acceptance TEXT"),T(t,"projects","fused_from","fused_from TEXT"),T(t,"users","username","username TEXT"),r=(s=t).prepare("PRAGMA table_info(users)").all(),r.find(e=>"email"===e.name)?.notnull===1&&(s.exec("PRAGMA foreign_keys = OFF"),s.exec(`
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
         AND NOT EXISTS (SELECT 1 FROM artifacts a WHERE a.project_id = p.id)`).all(),r=e.prepare("INSERT INTO artifacts (id, project_id, version_id, seq, notes, created_at) VALUES (?, ?, ?, 1, ?, ?)");for(let e of t)r.run(`a_${(0,E.randomBytes)(9).toString("base64url")}`,e.project_id,e.version_id,e.prompt,Date.now())}(t),d.__quarkDb=t);e.s(["db",0,N,"now",0,function(){return Date.now()}])},21199,e=>{"use strict";let t=new Map,r=globalThis;r.__quarkRlSweep||(r.__quarkRlSweep=setInterval(function(){let e=Date.now()-864e5;for(let[r,s]of t){let a=s.filter(t=>t>e);0===a.length?t.delete(r):t.set(r,a)}},6e5)),e.s(["clientIp",0,function(e){let t=e.headers.get("x-forwarded-for");return t?t.split(",")[0].trim():"local"},"rateLimit",0,function(e,r,s){let a=Date.now(),E=(t.get(e)??[]).filter(e=>e>a-s);return E.length>=r?{ok:!1,retryAfterSec:Math.ceil((E[0]+s-a)/1e3)}:(E.push(a),t.set(e,E),{ok:!0,retryAfterSec:0})}])},68362,e=>{"use strict";var t=e.i(66680),r=e.i(43793);function s(e,s,a){r.db.prepare("UPDATE users SET credits = credits + ? WHERE id = ?").run(s,e),r.db.prepare("INSERT INTO credit_events (id, user_id, delta, reason, created_at) VALUES (?, ?, ?, ?, ?)").run(`ce_${(0,t.randomBytes)(8).toString("base64url")}`,e,s,a,(0,r.now)())}function a(e,t){return!!r.db.prepare("SELECT 1 FROM credit_events WHERE user_id = ? AND reason = ?").get(e,t)}let E={free:0,pro:100,max:400};e.s(["BANNER_BONUS",0,26,"PLANS",0,["free","pro","max"],"SIGNUP_BONUS",0,20,"balance",0,function(e){let t=r.db.prepare("SELECT credits FROM users WHERE id = ?").get(e);return t?.credits??0},"charge",0,function(e,s,a){return 0!==Number(r.db.prepare("UPDATE users SET credits = credits - ? WHERE id = ? AND credits >= ?").run(s,e,s).changes)&&(r.db.prepare("INSERT INTO credit_events (id, user_id, delta, reason, created_at) VALUES (?, ?, ?, ?, ?)").run(`ce_${(0,t.randomBytes)(8).toString("base64url")}`,e,-s,a,(0,r.now)()),!0)},"generationCost",0,function(e,t,r,s=!1){return("deep"===e?5:"mixed"===e?3:1)+ +!!t+ +!!r+2*!!s},"hasClaimed",0,a,"recentEvents",0,function(e,t=20){return r.db.prepare("SELECT delta, reason, created_at FROM credit_events WHERE user_id = ? ORDER BY created_at DESC LIMIT ?").all(e,t).map(e=>({...e}))},"recordEvent",0,s,"redeemCode",0,function(e,t){let a=t.trim().toUpperCase(),E=r.db.prepare("SELECT amount, used_by FROM redeem_codes WHERE code = ?").get(a);return E?E.used_by||0===Number(r.db.prepare("UPDATE redeem_codes SET used_by = ?, used_at = ? WHERE code = ? AND used_by IS NULL").run(e,(0,r.now)(),a).changes)?{ok:!1,error:"该兑换码已被使用"}:(s(e,E.amount,`redeem:${a}`),{ok:!0,amount:E.amount}):{ok:!1,error:"兑换码不存在"}},"switchPlan",0,function(e,t){let n=r.db.prepare("SELECT plan FROM users WHERE id = ?").get(e);if(!n)return{ok:!1,error:"用户不存在"};if(n.plan===t)return{ok:!1,error:"已是当前套餐"};r.db.prepare("UPDATE users SET plan = ? WHERE id = ?").run(t,e);let o=`plan:${t}`;return E[t]>0&&!a(e,o)?(s(e,E[t],o),{ok:!0,bonus:E[t]}):{ok:!0,bonus:0}}])},6706,e=>{"use strict";var t=e.i(47909),r=e.i(74017),s=e.i(96250),a=e.i(59756),E=e.i(61916),n=e.i(74677),o=e.i(69741),i=e.i(16795),T=e.i(87718),d=e.i(95169),N=e.i(47587),u=e.i(66012),p=e.i(70101),l=e.i(26937),c=e.i(10372),L=e.i(93695);e.i(20232);var R=e.i(220),_=e.i(89171),O=e.i(43793),A=e.i(79832),I=e.i(21199),m=e.i(68362);let S=/^[a-zA-Z0-9_一-龥-]{2,20}$/;async function U(e){let t=(0,I.rateLimit)(`auth:${(0,I.clientIp)(e)}`,10,6e4);if(!t.ok)return _.NextResponse.json({error:`尝试过于频繁,请 ${t.retryAfterSec} 秒后再试`},{status:429});let{username:r,email:s,password:a,name:E}=await e.json().catch(()=>({})),n="string"==typeof r&&r.trim()?r.trim():null,o="string"==typeof s&&s.trim()?s.trim().toLowerCase():null;if(!n&&!o)return _.NextResponse.json({error:"用户名与邮箱至少填写一项"},{status:400});if(n&&!S.test(n))return _.NextResponse.json({error:"用户名需为 2-20 位字母、数字、中文、下划线或中划线"},{status:400});if(o&&!/^\S+@\S+\.\S+$/.test(o))return _.NextResponse.json({error:"邮箱格式不正确"},{status:400});if("string"!=typeof a||a.length<10||!/[a-zA-Z]/.test(a)||!/[0-9]/.test(a))return _.NextResponse.json({error:"密码至少 10 位,且需同时包含字母和数字"},{status:400});let i="string"==typeof E&&E.trim()?E.trim().slice(0,40):n??o.split("@")[0];if(o&&O.db.prepare("SELECT id FROM users WHERE email = ?").get(o))return _.NextResponse.json({error:"该邮箱已注册,请直接登录"},{status:409});if(n&&O.db.prepare("SELECT id FROM users WHERE lower(username) = lower(?)").get(n))return _.NextResponse.json({error:"该用户名已被占用,请换一个"},{status:409});let T=(0,A.newId)("u");return O.db.prepare("INSERT INTO users (id, email, username, name, password_hash, created_at) VALUES (?, ?, ?, ?, ?, ?)").run(T,o,n,i,(0,A.hashPassword)(a),(0,O.now)()),(0,m.recordEvent)(T,m.SIGNUP_BONUS,"signup"),await (0,A.createSession)(T),_.NextResponse.json({ok:!0})}e.s(["POST",0,U],26170);var C=e.i(26170);let X=new t.AppRouteRouteModule({definition:{kind:r.RouteKind.APP_ROUTE,page:"/api/auth/register/route",pathname:"/api/auth/register",filename:"route",bundlePath:""},distDir:".next-ci",relativeProjectDir:"",resolvedPagePath:"[project]/src/app/api/auth/register/route.ts",nextConfigOutput:"",userland:C,...{}}),{workAsyncStorage:f,workUnitAsyncStorage:h,serverHooks:x}=X;async function g(e,t,s){s.requestMeta&&(0,a.setRequestMeta)(e,s.requestMeta),X.isDev&&(0,a.addRequestMeta)(e,"devRequestTimingInternalsEnd",process.hrtime.bigint());let _="/api/auth/register/route";_=_.replace(/\/index$/,"")||"/";let O=await X.prepare(e,t,{srcPage:_,multiZoneDraftMode:!1});if(!O)return t.statusCode=400,t.end("Bad Request"),null==s.waitUntil||s.waitUntil.call(s,Promise.resolve()),null;let{buildId:A,deploymentId:I,params:m,nextConfig:S,parsedUrl:U,isDraftMode:C,prerenderManifest:f,routerServerContext:h,isOnDemandRevalidate:x,revalidateOnlyGenerated:g,resolvedPathname:v,clientReferenceManifest:b,serverActionsManifest:j}=O,D=(0,o.normalizeAppPath)(_),w=!!(f.dynamicRoutes[D]||f.routes[v]),F=async()=>((null==h?void 0:h.render404)?await h.render404(e,t,U,!1):t.end("This page could not be found"),null);if(w&&!C){let e=!!f.routes[v],t=f.dynamicRoutes[D];if(t&&!1===t.fallback&&!e){if(S.adapterPath)return await F();throw new L.NoFallbackError}}let y=null;!w||X.isDev||C||(y="/index"===(y=v)?"/":y);let P=!0===X.isDev||!w,M=w&&!P;j&&b&&(0,n.setManifestsSingleton)({page:_,clientReferenceManifest:b,serverActionsManifest:j});let k=e.method||"GET",G=(0,E.getTracer)(),q=G.getActiveScopeSpan(),H=!!(null==h?void 0:h.isWrappedByNextServer),B=!!(0,a.getRequestMeta)(e,"minimalMode"),K=(0,a.getRequestMeta)(e,"incrementalCache")||await X.getIncrementalCache(e,S,f,B);null==K||K.resetRequestCache(),globalThis.__incrementalCache=K;let Y={params:m,previewProps:f.preview,renderOpts:{experimental:{authInterrupts:!!S.experimental.authInterrupts},cacheComponents:!!S.cacheComponents,supportsDynamicResponse:P,incrementalCache:K,cacheLifeProfiles:S.cacheLife,waitUntil:s.waitUntil,onClose:e=>{t.on("close",e)},onAfterTaskError:void 0,onInstrumentationRequestError:(t,r,s,a)=>X.onRequestError(e,t,s,a,h)},sharedContext:{buildId:A,deploymentId:I}},$=new i.NodeNextRequest(e),W=new i.NodeNextResponse(t),V=T.NextRequestAdapter.fromNodeNextRequest($,(0,T.signalFromNodeResponse)(t));try{let a,n=async e=>X.handle(V,Y).finally(()=>{if(!e)return;e.setAttributes({"http.status_code":t.statusCode,"next.rsc":!1});let r=G.getRootSpanAttributes();if(!r)return;if(r.get("next.span_type")!==d.BaseServerSpan.handleRequest)return void console.warn(`Unexpected root span type '${r.get("next.span_type")}'. Please report this Next.js issue https://github.com/vercel/next.js`);let s=r.get("next.route");if(s){let t=`${k} ${s}`;e.setAttributes({"next.route":s,"http.route":s,"next.span_name":t}),e.updateName(t),a&&a!==e&&(a.setAttribute("http.route",s),a.updateName(t))}else e.updateName(`${k} ${_}`)}),o=async a=>{var E,o;let i=async({previousCacheEntry:r})=>{try{if(!B&&x&&g&&!r)return t.statusCode=404,t.setHeader("x-nextjs-cache","REVALIDATED"),t.end("This page could not be found"),null;let E=await n(a);e.fetchMetrics=Y.renderOpts.fetchMetrics;let o=Y.renderOpts.pendingWaitUntil;o&&s.waitUntil&&(s.waitUntil(o),o=void 0);let i=Y.renderOpts.collectedTags;if(!w)return await (0,u.sendResponse)($,W,E,Y.renderOpts.pendingWaitUntil),null;{let e=await E.blob(),t=(0,p.toNodeOutgoingHttpHeaders)(E.headers);i&&(t[c.NEXT_CACHE_TAGS_HEADER]=i),!t["content-type"]&&e.type&&(t["content-type"]=e.type);let r=void 0!==Y.renderOpts.collectedRevalidate&&!(Y.renderOpts.collectedRevalidate>=c.INFINITE_CACHE)&&Y.renderOpts.collectedRevalidate,s=void 0===Y.renderOpts.collectedExpire||Y.renderOpts.collectedExpire>=c.INFINITE_CACHE?void 0:Y.renderOpts.collectedExpire;return{value:{kind:R.CachedRouteKind.APP_ROUTE,status:E.status,body:Buffer.from(await e.arrayBuffer()),headers:t},cacheControl:{revalidate:r,expire:s}}}}catch(t){throw(null==r?void 0:r.isStale)&&await X.onRequestError(e,t,{routerKind:"App Router",routePath:_,routeType:"route",revalidateReason:(0,N.getRevalidateReason)({isStaticGeneration:M,isOnDemandRevalidate:x})},!1,h),t}},T=await X.handleResponse({req:e,nextConfig:S,cacheKey:y,routeKind:r.RouteKind.APP_ROUTE,isFallback:!1,prerenderManifest:f,isRoutePPREnabled:!1,isOnDemandRevalidate:x,revalidateOnlyGenerated:g,responseGenerator:i,waitUntil:s.waitUntil,isMinimalMode:B});if(!w)return null;if((null==T||null==(E=T.value)?void 0:E.kind)!==R.CachedRouteKind.APP_ROUTE)throw Object.defineProperty(Error(`Invariant: app-route received invalid cache entry ${null==T||null==(o=T.value)?void 0:o.kind}`),"__NEXT_ERROR_CODE",{value:"E701",enumerable:!1,configurable:!0});B||t.setHeader("x-nextjs-cache",x?"REVALIDATED":T.isMiss?"MISS":T.isStale?"STALE":"HIT"),C&&t.setHeader("Cache-Control","private, no-cache, no-store, max-age=0, must-revalidate");let d=(0,p.fromNodeOutgoingHttpHeaders)(T.value.headers);return B&&w||d.delete(c.NEXT_CACHE_TAGS_HEADER),!T.cacheControl||t.getHeader("Cache-Control")||d.get("Cache-Control")||d.set("Cache-Control",(0,l.getCacheControlHeader)(T.cacheControl)),await (0,u.sendResponse)($,W,new Response(T.value.body,{headers:d,status:T.value.status||200})),null};H&&q?await o(q):(a=G.getActiveScopeSpan(),await G.withPropagatedContext(e.headers,()=>G.trace(d.BaseServerSpan.handleRequest,{spanName:`${k} ${_}`,kind:E.SpanKind.SERVER,attributes:{"http.method":k,"http.target":e.url}},o),void 0,!H))}catch(t){if(t instanceof L.NoFallbackError||await X.onRequestError(e,t,{routerKind:"App Router",routePath:D,routeType:"route",revalidateReason:(0,N.getRevalidateReason)({isStaticGeneration:M,isOnDemandRevalidate:x})},!1,h),w)throw t;return await (0,u.sendResponse)($,W,new Response(null,{status:500})),null}}e.s(["handler",0,g,"patchFetch",0,function(){return(0,s.patchFetch)({workAsyncStorage:f,workUnitAsyncStorage:h})},"routeModule",0,X,"serverHooks",0,x,"workAsyncStorage",0,f,"workUnitAsyncStorage",0,h],6706)}];

//# sourceMappingURL=%5Broot-of-the-server%5D__0rm8cmw._.js.map