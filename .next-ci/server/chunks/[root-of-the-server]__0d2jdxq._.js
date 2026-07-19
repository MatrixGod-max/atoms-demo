module.exports=[24361,(e,t,r)=>{t.exports=e.x("util",()=>require("util"))},22734,(e,t,r)=>{t.exports=e.x("fs",()=>require("fs"))},88947,(e,t,r)=>{t.exports=e.x("stream",()=>require("stream"))},6461,(e,t,r)=>{t.exports=e.x("zlib",()=>require("zlib"))},49719,(e,t,r)=>{t.exports=e.x("assert",()=>require("assert"))},874,(e,t,r)=>{t.exports=e.x("buffer",()=>require("buffer"))},18622,(e,t,r)=>{t.exports=e.x("next/dist/compiled/next-server/app-page-turbo.runtime.prod.js",()=>require("next/dist/compiled/next-server/app-page-turbo.runtime.prod.js"))},56704,(e,t,r)=>{t.exports=e.x("next/dist/server/app-render/work-async-storage.external.js",()=>require("next/dist/server/app-render/work-async-storage.external.js"))},32319,(e,t,r)=>{t.exports=e.x("next/dist/server/app-render/work-unit-async-storage.external.js",()=>require("next/dist/server/app-render/work-unit-async-storage.external.js"))},24725,(e,t,r)=>{t.exports=e.x("next/dist/server/app-render/after-task-async-storage.external.js",()=>require("next/dist/server/app-render/after-task-async-storage.external.js"))},70406,(e,t,r)=>{t.exports=e.x("next/dist/compiled/@opentelemetry/api",()=>require("next/dist/compiled/@opentelemetry/api"))},93695,(e,t,r)=>{t.exports=e.x("next/dist/shared/lib/no-fallback-error.external.js",()=>require("next/dist/shared/lib/no-fallback-error.external.js"))},66680,(e,t,r)=>{t.exports=e.x("node:crypto",()=>require("node:crypto"))},2157,(e,t,r)=>{t.exports=e.x("node:fs",()=>require("node:fs"))},50227,(e,t,r)=>{t.exports=e.x("node:path",()=>require("node:path"))},43793,e=>{"use strict";let t,r;var a,s=e.x("node:sqlite",()=>require("node:sqlite"),!0),n=e.i(66680),i=e.i(2157),o=e.i(50227);let E=process.env.DATA_DIR||o.default.join(process.cwd(),"data");function T(e,t,r,a){e.prepare(`PRAGMA table_info(${t})`).all().some(e=>e.name===r)||e.exec(`ALTER TABLE ${t} ADD COLUMN ${a}`)}let d=globalThis,p=d.__quarkDb??(i.default.mkdirSync(E,{recursive:!0}),(t=new s.DatabaseSync(o.default.join(E,"quark.db"))).exec("PRAGMA busy_timeout = 5000"),t.exec(`
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
         AND NOT EXISTS (SELECT 1 FROM artifacts a WHERE a.project_id = p.id)`).all(),r=e.prepare("INSERT INTO artifacts (id, project_id, version_id, seq, notes, created_at) VALUES (?, ?, ?, 1, ?, ?)");for(let e of t)r.run(`a_${(0,n.randomBytes)(9).toString("base64url")}`,e.project_id,e.version_id,e.prompt,Date.now())}(t),d.__quarkDb=t);e.s(["db",0,p,"now",0,function(){return Date.now()}])},95012,e=>{"use strict";var t=e.i(43793);e.s(["ownedProject",0,function(e,r){return t.db.prepare("SELECT * FROM projects WHERE id = ? AND user_id = ?").get(r,e)}])},21199,e=>{"use strict";let t=new Map,r=globalThis;r.__quarkRlSweep||(r.__quarkRlSweep=setInterval(function(){let e=Date.now()-864e5;for(let[r,a]of t){let s=a.filter(t=>t>e);0===s.length?t.delete(r):t.set(r,s)}},6e5)),e.s(["clientIp",0,function(e){let t=e.headers.get("x-forwarded-for");return t?t.split(",")[0].trim():"local"},"rateLimit",0,function(e,r,a){let s=Date.now(),n=(t.get(e)??[]).filter(e=>e>s-a);return n.length>=r?{ok:!1,retryAfterSec:Math.ceil((n[0]+a-s)/1e3)}:(n.push(s),t.set(e,n),{ok:!0,retryAfterSec:0})}])},68362,e=>{"use strict";var t=e.i(66680),r=e.i(43793);function a(e,a,s){r.db.prepare("UPDATE users SET credits = credits + ? WHERE id = ?").run(a,e),r.db.prepare("INSERT INTO credit_events (id, user_id, delta, reason, created_at) VALUES (?, ?, ?, ?, ?)").run(`ce_${(0,t.randomBytes)(8).toString("base64url")}`,e,a,s,(0,r.now)())}function s(e,t){return!!r.db.prepare("SELECT 1 FROM credit_events WHERE user_id = ? AND reason = ?").get(e,t)}let n={free:0,pro:100,max:400};e.s(["BANNER_BONUS",0,26,"PLANS",0,["free","pro","max"],"SIGNUP_BONUS",0,20,"balance",0,function(e){let t=r.db.prepare("SELECT credits FROM users WHERE id = ?").get(e);return t?.credits??0},"charge",0,function(e,a,s){return 0!==Number(r.db.prepare("UPDATE users SET credits = credits - ? WHERE id = ? AND credits >= ?").run(a,e,a).changes)&&(r.db.prepare("INSERT INTO credit_events (id, user_id, delta, reason, created_at) VALUES (?, ?, ?, ?, ?)").run(`ce_${(0,t.randomBytes)(8).toString("base64url")}`,e,-a,s,(0,r.now)()),!0)},"generationCost",0,function(e,t,r,a=!1){return("deep"===e?5:"mixed"===e?3:1)+ +!!t+ +!!r+2*!!a},"hasClaimed",0,s,"recentEvents",0,function(e,t=20){return r.db.prepare("SELECT delta, reason, created_at FROM credit_events WHERE user_id = ? ORDER BY created_at DESC LIMIT ?").all(e,t).map(e=>({...e}))},"recordEvent",0,a,"redeemCode",0,function(e,t){let s=t.trim().toUpperCase(),n=r.db.prepare("SELECT amount, used_by FROM redeem_codes WHERE code = ?").get(s);return n?n.used_by||0===Number(r.db.prepare("UPDATE redeem_codes SET used_by = ?, used_at = ? WHERE code = ? AND used_by IS NULL").run(e,(0,r.now)(),s).changes)?{ok:!1,error:"该兑换码已被使用"}:(a(e,n.amount,`redeem:${s}`),{ok:!0,amount:n.amount}):{ok:!1,error:"兑换码不存在"}},"switchPlan",0,function(e,t){let i=r.db.prepare("SELECT plan FROM users WHERE id = ?").get(e);if(!i)return{ok:!1,error:"用户不存在"};if(i.plan===t)return{ok:!1,error:"已是当前套餐"};r.db.prepare("UPDATE users SET plan = ? WHERE id = ?").run(t,e);let o=`plan:${t}`;return n[t]>0&&!s(e,o)?(a(e,n[t],o),{ok:!0,bonus:n[t]}):{ok:!0,bonus:0}}])},83159,e=>{"use strict";var t=e.i(43793);let r=new Set(["text/plain","text/markdown","text/csv","application/json"]),a=new Set(["image/png","image/jpeg","image/webp","image/svg+xml"]);function s(e){return r.has(e)?"text":a.has(e)?"image":null}e.s(["attachmentKind",0,s,"inlineImageAssets",0,function(e,t){let r=e;for(let e of t)"image"===e.kind&&e.dataUri&&(r=r.split(`asset://${e.filename}`).join(e.dataUri));return r},"listAttachments",0,function(e){return t.db.prepare("SELECT id, filename, mime, kind, size FROM attachments WHERE project_id = ? ORDER BY created_at").all(e).map(e=>({...e}))},"loadPipelineAttachments",0,function(e){return t.db.prepare("SELECT filename, mime, kind, data FROM attachments WHERE project_id = ? ORDER BY created_at").all(e).map(e=>{let t=Buffer.from(e.data);return"text"===e.kind?{filename:e.filename,kind:e.kind,mime:e.mime,text:t.toString("utf8")}:{filename:e.filename,kind:e.kind,mime:e.mime,dataUri:`data:${e.mime};base64,${t.toString("base64")}`}})},"validateAttachment",0,function(e,t,r){let a=s(e);if(!a)return"仅支持文本(txt/md/csv/json)与图片(png/jpg/webp/svg)";if(r>=6)return"每个项目最多 6 个附件";let n="text"===a?65536:524288;return t>n?`${"text"===a?"文本":"图片"}附件不能超过 ${n/1024}KB`:0===t?"文件为空":null}])},42939,e=>e.a(async(t,r)=>{try{var a=e.i(89171),s=e.i(43793),n=e.i(79832),i=e.i(95012),o=e.i(83555),E=e.i(21199),T=e.i(93520),d=e.i(68362),p=t([o]);[o]=p.then?(await p)():p;let l=Number(process.env.DAILY_GENERATION_QUOTA||30);async function u(e,t){let r=await (0,n.getUser)();if(!r)return a.NextResponse.json({error:"未登录"},{status:401});let p=(0,n.demoGuard)(r);if(p)return a.NextResponse.json({error:p},{status:403});let{id:u}=await t.params,c=(0,i.ownedProject)(r.id,u);if(!c)return a.NextResponse.json({error:"项目不存在"},{status:404});let{prompt:N,research:R,team:L,mode:_,target:m,goalLoop:O}=await e.json().catch(()=>({}));if("string"!=typeof N||!N.trim())return a.NextResponse.json({error:"请输入需求"},{status:400});if(!0===O&&!c.goal)return a.NextResponse.json({error:"请先为项目设置目标"},{status:400});let A=m&&"string"==typeof m.selector&&m.selector.trim()?{selector:m.selector.trim().slice(0,300),snippet:"string"==typeof m.snippet?m.snippet.slice(0,1e3):""}:null,I=(0,E.rateLimit)(`gen:${r.id}`,3,6e5);if(!I.ok)return a.NextResponse.json({error:`生成过于频繁(10 分钟内最多 3 次),请 ${I.retryAfterSec} 秒后再试`},{status:429});if(s.db.prepare("SELECT COUNT(*) AS c FROM jobs WHERE user_id = ? AND created_at > ?").get(r.id,(0,s.now)()-864e5).c>=l)return a.NextResponse.json({error:`24 小时生成额度(${l} 次)已用完,明天再来吧`},{status:429});let S=!!c.fused_from&&!c.current_version_id,f=(0,d.generationCost)((0,T.normalizeMode)(_),!0===R,!0===L,S);if(!(0,d.charge)(r.id,f,`generate:${(0,T.normalizeMode)(_)}`))return a.NextResponse.json({error:`积分不足(本次需 ${f},余额 ${(0,d.balance)(r.id)})。点击顶部横幅领取免费积分。`},{status:402});try{let{jobId:e,position:t}=o.jobRunner.start(u,r.id,N.trim(),!0===R,(0,T.normalizeMode)(_),!0===L,f,A);return!0===O&&s.db.prepare("UPDATE projects SET goal_active = 1, goal_round = 0, goal_status = 'running' WHERE id = ?").run(u),a.NextResponse.json({jobId:e,position:t,cost:f,credits:(0,d.balance)(r.id)})}catch(e){if((0,d.charge)(r.id,-f,"refund:start-failed"),409===e.code)return a.NextResponse.json({error:e.message,jobId:e.jobId},{status:409});throw e}}e.s(["POST",0,u,"dynamic",0,"force-dynamic"]),r()}catch(e){r(e)}},!1),14823,e=>e.a(async(t,r)=>{try{var a=e.i(47909),s=e.i(74017),n=e.i(96250),i=e.i(59756),o=e.i(61916),E=e.i(74677),T=e.i(69741),d=e.i(16795),p=e.i(87718),u=e.i(95169),l=e.i(47587),c=e.i(66012),N=e.i(70101),R=e.i(26937),L=e.i(10372),_=e.i(93695);e.i(20232);var m=e.i(220),O=e.i(42939),A=t([O]);[O]=A.then?(await A)():A;let S=new a.AppRouteRouteModule({definition:{kind:s.RouteKind.APP_ROUTE,page:"/api/projects/[id]/generate/route",pathname:"/api/projects/[id]/generate",filename:"route",bundlePath:""},distDir:".next-ci",relativeProjectDir:"",resolvedPagePath:"[project]/src/app/api/projects/[id]/generate/route.ts",nextConfigOutput:"",userland:O,...{}}),{workAsyncStorage:f,workUnitAsyncStorage:U,serverHooks:C}=S;async function I(e,t,r){r.requestMeta&&(0,i.setRequestMeta)(e,r.requestMeta),S.isDev&&(0,i.addRequestMeta)(e,"devRequestTimingInternalsEnd",process.hrtime.bigint());let a="/api/projects/[id]/generate/route";a=a.replace(/\/index$/,"")||"/";let n=await S.prepare(e,t,{srcPage:a,multiZoneDraftMode:!1});if(!n)return t.statusCode=400,t.end("Bad Request"),null==r.waitUntil||r.waitUntil.call(r,Promise.resolve()),null;let{buildId:O,deploymentId:A,params:I,nextConfig:f,parsedUrl:U,isDraftMode:C,prerenderManifest:x,routerServerContext:g,isOnDemandRevalidate:X,revalidateOnlyGenerated:h,resolvedPathname:v,clientReferenceManifest:j,serverActionsManifest:b}=n,D=(0,T.normalizeAppPath)(a),w=!!(x.dynamicRoutes[D]||x.routes[v]),F=async()=>((null==g?void 0:g.render404)?await g.render404(e,t,U,!1):t.end("This page could not be found"),null);if(w&&!C){let e=!!x.routes[v],t=x.dynamicRoutes[D];if(t&&!1===t.fallback&&!e){if(f.adapterPath)return await F();throw new _.NoFallbackError}}let y=null;!w||S.isDev||C||(y=v,y="/index"===y?"/":y);let k=!0===S.isDev||!w,M=w&&!k;b&&j&&(0,E.setManifestsSingleton)({page:a,clientReferenceManifest:j,serverActionsManifest:b});let P=e.method||"GET",G=(0,o.getTracer)(),q=G.getActiveScopeSpan(),H=!!(null==g?void 0:g.isWrappedByNextServer),B=!!(0,i.getRequestMeta)(e,"minimalMode"),Y=(0,i.getRequestMeta)(e,"incrementalCache")||await S.getIncrementalCache(e,f,x,B);null==Y||Y.resetRequestCache(),globalThis.__incrementalCache=Y;let K={params:I,previewProps:x.preview,renderOpts:{experimental:{authInterrupts:!!f.experimental.authInterrupts},cacheComponents:!!f.cacheComponents,supportsDynamicResponse:k,incrementalCache:Y,cacheLifeProfiles:f.cacheLife,waitUntil:r.waitUntil,onClose:e=>{t.on("close",e)},onAfterTaskError:void 0,onInstrumentationRequestError:(t,r,a,s)=>S.onRequestError(e,t,a,s,g)},sharedContext:{buildId:O,deploymentId:A}},$=new d.NodeNextRequest(e),W=new d.NodeNextResponse(t),z=p.NextRequestAdapter.fromNodeNextRequest($,(0,p.signalFromNodeResponse)(t));try{let n,i=async e=>S.handle(z,K).finally(()=>{if(!e)return;e.setAttributes({"http.status_code":t.statusCode,"next.rsc":!1});let r=G.getRootSpanAttributes();if(!r)return;if(r.get("next.span_type")!==u.BaseServerSpan.handleRequest)return void console.warn(`Unexpected root span type '${r.get("next.span_type")}'. Please report this Next.js issue https://github.com/vercel/next.js`);let s=r.get("next.route");if(s){let t=`${P} ${s}`;e.setAttributes({"next.route":s,"http.route":s,"next.span_name":t}),e.updateName(t),n&&n!==e&&(n.setAttribute("http.route",s),n.updateName(t))}else e.updateName(`${P} ${a}`)}),E=async n=>{var o,E;let T=async({previousCacheEntry:s})=>{try{if(!B&&X&&h&&!s)return t.statusCode=404,t.setHeader("x-nextjs-cache","REVALIDATED"),t.end("This page could not be found"),null;let a=await i(n);e.fetchMetrics=K.renderOpts.fetchMetrics;let o=K.renderOpts.pendingWaitUntil;o&&r.waitUntil&&(r.waitUntil(o),o=void 0);let E=K.renderOpts.collectedTags;if(!w)return await (0,c.sendResponse)($,W,a,K.renderOpts.pendingWaitUntil),null;{let e=await a.blob(),t=(0,N.toNodeOutgoingHttpHeaders)(a.headers);E&&(t[L.NEXT_CACHE_TAGS_HEADER]=E),!t["content-type"]&&e.type&&(t["content-type"]=e.type);let r=void 0!==K.renderOpts.collectedRevalidate&&!(K.renderOpts.collectedRevalidate>=L.INFINITE_CACHE)&&K.renderOpts.collectedRevalidate,s=void 0===K.renderOpts.collectedExpire||K.renderOpts.collectedExpire>=L.INFINITE_CACHE?void 0:K.renderOpts.collectedExpire;return{value:{kind:m.CachedRouteKind.APP_ROUTE,status:a.status,body:Buffer.from(await e.arrayBuffer()),headers:t},cacheControl:{revalidate:r,expire:s}}}}catch(t){throw(null==s?void 0:s.isStale)&&await S.onRequestError(e,t,{routerKind:"App Router",routePath:a,routeType:"route",revalidateReason:(0,l.getRevalidateReason)({isStaticGeneration:M,isOnDemandRevalidate:X})},!1,g),t}},d=await S.handleResponse({req:e,nextConfig:f,cacheKey:y,routeKind:s.RouteKind.APP_ROUTE,isFallback:!1,prerenderManifest:x,isRoutePPREnabled:!1,isOnDemandRevalidate:X,revalidateOnlyGenerated:h,responseGenerator:T,waitUntil:r.waitUntil,isMinimalMode:B});if(!w)return null;if((null==d||null==(o=d.value)?void 0:o.kind)!==m.CachedRouteKind.APP_ROUTE)throw Object.defineProperty(Error(`Invariant: app-route received invalid cache entry ${null==d||null==(E=d.value)?void 0:E.kind}`),"__NEXT_ERROR_CODE",{value:"E701",enumerable:!1,configurable:!0});B||t.setHeader("x-nextjs-cache",X?"REVALIDATED":d.isMiss?"MISS":d.isStale?"STALE":"HIT"),C&&t.setHeader("Cache-Control","private, no-cache, no-store, max-age=0, must-revalidate");let p=(0,N.fromNodeOutgoingHttpHeaders)(d.value.headers);return B&&w||p.delete(L.NEXT_CACHE_TAGS_HEADER),!d.cacheControl||t.getHeader("Cache-Control")||p.get("Cache-Control")||p.set("Cache-Control",(0,R.getCacheControlHeader)(d.cacheControl)),await (0,c.sendResponse)($,W,new Response(d.value.body,{headers:p,status:d.value.status||200})),null};H&&q?await E(q):(n=G.getActiveScopeSpan(),await G.withPropagatedContext(e.headers,()=>G.trace(u.BaseServerSpan.handleRequest,{spanName:`${P} ${a}`,kind:o.SpanKind.SERVER,attributes:{"http.method":P,"http.target":e.url}},E),void 0,!H))}catch(t){if(t instanceof _.NoFallbackError||await S.onRequestError(e,t,{routerKind:"App Router",routePath:D,routeType:"route",revalidateReason:(0,l.getRevalidateReason)({isStaticGeneration:M,isOnDemandRevalidate:X})},!1,g),w)throw t;return await (0,c.sendResponse)($,W,new Response(null,{status:500})),null}}e.s(["handler",0,I,"patchFetch",0,function(){return(0,n.patchFetch)({workAsyncStorage:f,workUnitAsyncStorage:U})},"routeModule",0,S,"serverHooks",0,C,"workAsyncStorage",0,f,"workUnitAsyncStorage",0,U]),r()}catch(e){r(e)}},!1)];

//# sourceMappingURL=%5Broot-of-the-server%5D__0d2jdxq._.js.map