module.exports=[18622,(e,t,r)=>{t.exports=e.x("next/dist/compiled/next-server/app-page-turbo.runtime.prod.js",()=>require("next/dist/compiled/next-server/app-page-turbo.runtime.prod.js"))},56704,(e,t,r)=>{t.exports=e.x("next/dist/server/app-render/work-async-storage.external.js",()=>require("next/dist/server/app-render/work-async-storage.external.js"))},32319,(e,t,r)=>{t.exports=e.x("next/dist/server/app-render/work-unit-async-storage.external.js",()=>require("next/dist/server/app-render/work-unit-async-storage.external.js"))},24725,(e,t,r)=>{t.exports=e.x("next/dist/server/app-render/after-task-async-storage.external.js",()=>require("next/dist/server/app-render/after-task-async-storage.external.js"))},70406,(e,t,r)=>{t.exports=e.x("next/dist/compiled/@opentelemetry/api",()=>require("next/dist/compiled/@opentelemetry/api"))},93695,(e,t,r)=>{t.exports=e.x("next/dist/shared/lib/no-fallback-error.external.js",()=>require("next/dist/shared/lib/no-fallback-error.external.js"))},66680,(e,t,r)=>{t.exports=e.x("node:crypto",()=>require("node:crypto"))},2157,(e,t,r)=>{t.exports=e.x("node:fs",()=>require("node:fs"))},50227,(e,t,r)=>{t.exports=e.x("node:path",()=>require("node:path"))},43793,e=>{"use strict";let t,r;var a,s=e.x("node:sqlite",()=>require("node:sqlite"),!0),n=e.i(66680),E=e.i(2157),o=e.i(50227);let i=process.env.DATA_DIR||o.default.join(process.cwd(),"data");function T(e,t,r,a){e.prepare(`PRAGMA table_info(${t})`).all().some(e=>e.name===r)||e.exec(`ALTER TABLE ${t} ADD COLUMN ${a}`)}let d=globalThis,p=d.__quarkDb??(E.default.mkdirSync(i,{recursive:!0}),(t=new s.DatabaseSync(o.default.join(i,"quark.db"))).exec("PRAGMA busy_timeout = 5000"),t.exec(`
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
         AND NOT EXISTS (SELECT 1 FROM artifacts a WHERE a.project_id = p.id)`).all(),r=e.prepare("INSERT INTO artifacts (id, project_id, version_id, seq, notes, created_at) VALUES (?, ?, ?, 1, ?, ?)");for(let e of t)r.run(`a_${(0,n.randomBytes)(9).toString("base64url")}`,e.project_id,e.version_id,e.prompt,Date.now())}(t),d.__quarkDb=t);e.s(["db",0,p,"now",0,function(){return Date.now()}])},77981,e=>{"use strict";var t=e.i(47909),r=e.i(74017),a=e.i(96250),s=e.i(59756),n=e.i(61916),E=e.i(74677),o=e.i(69741),i=e.i(16795),T=e.i(87718),d=e.i(95169),p=e.i(47587),N=e.i(66012),l=e.i(70101),u=e.i(26937),c=e.i(10372),L=e.i(93695);e.i(20232);var R=e.i(220),_=e.i(89171),m=e.i(43793),O=e.i(79832);async function I(){let e=await (0,O.getUser)();if(!e)return _.NextResponse.json({error:"未登录"},{status:401});let t=m.db.prepare(`SELECT p.id, p.name, p.slug, p.updated_at, p.created_at,
              (SELECT COUNT(*) FROM app_versions v WHERE v.project_id = p.id) AS version_count
       FROM projects p WHERE p.user_id = ? ORDER BY p.updated_at DESC`).all(e.id);return _.NextResponse.json({projects:t})}async function A(e){let t=await (0,O.getUser)();if(!t)return _.NextResponse.json({error:"未登录"},{status:401});let r=(0,O.demoGuard)(t);if(r)return _.NextResponse.json({error:r},{status:403});let{prompt:a,remixSlug:s,templateId:n,platform:E,theme:o,connectors:i,goal:T,fuseSlugs:d}=await e.json().catch(()=>({})),p=Array.isArray(i)&&i.length?JSON.stringify(i.slice(0,5)):null,N="string"==typeof o&&o.trim()?o.trim().slice(0,20):null,l="string"==typeof T&&T.trim()?T.trim().slice(0,500):null;if("string"==typeof n&&n){let e=m.db.prepare("SELECT id, name, platform, html FROM templates WHERE id = ?").get(n);if(!e)return _.NextResponse.json({error:"模板不存在"},{status:404});let r=(0,O.newId)("p"),a=(0,O.newId)("v"),s=(0,m.now)();return m.db.prepare("INSERT INTO projects (id, user_id, name, platform, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)").run(r,t.id,e.name.slice(0,40),e.platform,s,s),m.db.prepare("INSERT INTO app_versions (id, project_id, num, html, review_notes, prompt, created_at) VALUES (?, ?, 1, ?, ?, ?, ?)").run(a,r,e.html,`模板「${e.name}」`,`模板快速开始:${e.name}`,s),m.db.prepare("UPDATE projects SET current_version_id = ? WHERE id = ?").run(a,r),m.db.prepare("INSERT INTO messages (id, project_id, role, content, created_at) VALUES (?, ?, 'agent', ?, ?)").run((0,O.newId)("m"),r,`已用模板「${e.name}」创建项目,v1 即模板本身。直接提需求(比如改文案、换品牌色、加板块),我会在模板基础上修改。`,s),_.NextResponse.json({id:r,fromTemplate:!0})}if(Array.isArray(d)){let e=d.filter(e=>"string"==typeof e&&!!e);if(2!==e.length||e[0]===e[1])return _.NextResponse.json({error:"聚变需要选择两个不同的已发布应用"},{status:400});let r=m.db.prepare(`SELECT p.slug, p.name, p.platform FROM projects p
       WHERE p.slug = ? AND p.published_version_id IS NOT NULL`),a=e.map(e=>r.get(e));if(a.some(e=>!e))return _.NextResponse.json({error:"源应用不存在或未发布"},{status:404});let[s,n]=a,E=(0,O.newId)("p"),o=(0,m.now)();return m.db.prepare("INSERT INTO projects (id, user_id, name, platform, fused_from, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)").run(E,t.id,`聚变 \xb7 ${s.name} \xd7 ${n.name}`.slice(0,40),s.platform,JSON.stringify([{slug:s.slug,name:s.name},{slug:n.slug,name:n.name}]),o,o),m.db.prepare("INSERT INTO messages (id, project_id, role, content, created_at) VALUES (?, ?, 'agent', ?, ?)").run((0,O.newId)("m"),E,`⚛ 已创建聚变项目:「${s.name}」\xd7「${n.name}」。首次生成将由聚变分析师拆解两者能力并合并为一个全新应用(消耗额外 2 积分)。`,o),_.NextResponse.json({id:E,fused:!0,sources:[s.name,n.name]})}if("string"==typeof s&&s){let e=m.db.prepare(`SELECT p.name, p.platform, v.html, v.spec FROM projects p JOIN app_versions v ON v.id = p.published_version_id
         WHERE p.slug = ? AND p.published_version_id IS NOT NULL`).get(s);if(!e)return _.NextResponse.json({error:"源应用不存在或未发布"},{status:404});let r=(0,O.newId)("p"),a=(0,O.newId)("v"),n=(0,m.now)();return m.db.prepare("INSERT INTO projects (id, user_id, name, platform, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)").run(r,t.id,`Remix \xb7 ${e.name}`.slice(0,40),e.platform,n,n),m.db.prepare("INSERT INTO app_versions (id, project_id, num, html, spec, review_notes, prompt, created_at) VALUES (?, ?, 1, ?, ?, ?, ?, ?)").run(a,r,e.html,e.spec,`Remix 自 /${s}`,`Remix 自 ${e.name}`,n),m.db.prepare("UPDATE projects SET current_version_id = ? WHERE id = ?").run(a,r),m.db.prepare("INSERT INTO messages (id, project_id, role, content, created_at) VALUES (?, ?, 'agent', ?, ?)").run((0,O.newId)("m"),r,`已从「${e.name}」Remix 出这个项目,当前 v1 与源应用一致。直接提需求,我会在它的基础上修改。`,n),_.NextResponse.json({id:r,remixed:!0})}if("string"!=typeof a||!a.trim())return _.NextResponse.json({error:"请描述你想要的应用"},{status:400});let u=(0,O.newId)("p"),c=(0,m.now)();return m.db.prepare("INSERT INTO projects (id, user_id, name, platform, theme, connectors, goal, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)").run(u,t.id,a.trim().slice(0,30),"mobile"===E?"mobile":"web",N,p,l,c,c),_.NextResponse.json({id:u,prompt:a.trim()})}e.s(["GET",0,I,"POST",0,A],50364);var S=e.i(50364);let U=new t.AppRouteRouteModule({definition:{kind:r.RouteKind.APP_ROUTE,page:"/api/projects/route",pathname:"/api/projects",filename:"route",bundlePath:""},distDir:".next-ci",relativeProjectDir:"",resolvedPagePath:"[project]/src/app/api/projects/route.ts",nextConfigOutput:"",userland:S,...{}}),{workAsyncStorage:C,workUnitAsyncStorage:X,serverHooks:x}=U;async function f(e,t,a){a.requestMeta&&(0,s.setRequestMeta)(e,a.requestMeta),U.isDev&&(0,s.addRequestMeta)(e,"devRequestTimingInternalsEnd",process.hrtime.bigint());let _="/api/projects/route";_=_.replace(/\/index$/,"")||"/";let m=await U.prepare(e,t,{srcPage:_,multiZoneDraftMode:!1});if(!m)return t.statusCode=400,t.end("Bad Request"),null==a.waitUntil||a.waitUntil.call(a,Promise.resolve()),null;let{buildId:O,deploymentId:I,params:A,nextConfig:S,parsedUrl:C,isDraftMode:X,prerenderManifest:x,routerServerContext:f,isOnDemandRevalidate:v,revalidateOnlyGenerated:j,resolvedPathname:g,clientReferenceManifest:h,serverActionsManifest:b}=m,D=(0,o.normalizeAppPath)(_),w=!!(x.dynamicRoutes[D]||x.routes[g]),F=async()=>((null==f?void 0:f.render404)?await f.render404(e,t,C,!1):t.end("This page could not be found"),null);if(w&&!X){let e=!!x.routes[g],t=x.dynamicRoutes[D];if(t&&!1===t.fallback&&!e){if(S.adapterPath)return await F();throw new L.NoFallbackError}}let y=null;!w||U.isDev||X||(y="/index"===(y=g)?"/":y);let P=!0===U.isDev||!w,M=w&&!P;b&&h&&(0,E.setManifestsSingleton)({page:_,clientReferenceManifest:h,serverActionsManifest:b});let G=e.method||"GET",k=(0,n.getTracer)(),q=k.getActiveScopeSpan(),H=!!(null==f?void 0:f.isWrappedByNextServer),K=!!(0,s.getRequestMeta)(e,"minimalMode"),Y=(0,s.getRequestMeta)(e,"incrementalCache")||await U.getIncrementalCache(e,S,x,K);null==Y||Y.resetRequestCache(),globalThis.__incrementalCache=Y;let B={params:A,previewProps:x.preview,renderOpts:{experimental:{authInterrupts:!!S.experimental.authInterrupts},cacheComponents:!!S.cacheComponents,supportsDynamicResponse:P,incrementalCache:Y,cacheLifeProfiles:S.cacheLife,waitUntil:a.waitUntil,onClose:e=>{t.on("close",e)},onAfterTaskError:void 0,onInstrumentationRequestError:(t,r,a,s)=>U.onRequestError(e,t,a,s,f)},sharedContext:{buildId:O,deploymentId:I}},$=new i.NodeNextRequest(e),W=new i.NodeNextResponse(t),V=T.NextRequestAdapter.fromNodeNextRequest($,(0,T.signalFromNodeResponse)(t));try{let s,E=async e=>U.handle(V,B).finally(()=>{if(!e)return;e.setAttributes({"http.status_code":t.statusCode,"next.rsc":!1});let r=k.getRootSpanAttributes();if(!r)return;if(r.get("next.span_type")!==d.BaseServerSpan.handleRequest)return void console.warn(`Unexpected root span type '${r.get("next.span_type")}'. Please report this Next.js issue https://github.com/vercel/next.js`);let a=r.get("next.route");if(a){let t=`${G} ${a}`;e.setAttributes({"next.route":a,"http.route":a,"next.span_name":t}),e.updateName(t),s&&s!==e&&(s.setAttribute("http.route",a),s.updateName(t))}else e.updateName(`${G} ${_}`)}),o=async s=>{var n,o;let i=async({previousCacheEntry:r})=>{try{if(!K&&v&&j&&!r)return t.statusCode=404,t.setHeader("x-nextjs-cache","REVALIDATED"),t.end("This page could not be found"),null;let n=await E(s);e.fetchMetrics=B.renderOpts.fetchMetrics;let o=B.renderOpts.pendingWaitUntil;o&&a.waitUntil&&(a.waitUntil(o),o=void 0);let i=B.renderOpts.collectedTags;if(!w)return await (0,N.sendResponse)($,W,n,B.renderOpts.pendingWaitUntil),null;{let e=await n.blob(),t=(0,l.toNodeOutgoingHttpHeaders)(n.headers);i&&(t[c.NEXT_CACHE_TAGS_HEADER]=i),!t["content-type"]&&e.type&&(t["content-type"]=e.type);let r=void 0!==B.renderOpts.collectedRevalidate&&!(B.renderOpts.collectedRevalidate>=c.INFINITE_CACHE)&&B.renderOpts.collectedRevalidate,a=void 0===B.renderOpts.collectedExpire||B.renderOpts.collectedExpire>=c.INFINITE_CACHE?void 0:B.renderOpts.collectedExpire;return{value:{kind:R.CachedRouteKind.APP_ROUTE,status:n.status,body:Buffer.from(await e.arrayBuffer()),headers:t},cacheControl:{revalidate:r,expire:a}}}}catch(t){throw(null==r?void 0:r.isStale)&&await U.onRequestError(e,t,{routerKind:"App Router",routePath:_,routeType:"route",revalidateReason:(0,p.getRevalidateReason)({isStaticGeneration:M,isOnDemandRevalidate:v})},!1,f),t}},T=await U.handleResponse({req:e,nextConfig:S,cacheKey:y,routeKind:r.RouteKind.APP_ROUTE,isFallback:!1,prerenderManifest:x,isRoutePPREnabled:!1,isOnDemandRevalidate:v,revalidateOnlyGenerated:j,responseGenerator:i,waitUntil:a.waitUntil,isMinimalMode:K});if(!w)return null;if((null==T||null==(n=T.value)?void 0:n.kind)!==R.CachedRouteKind.APP_ROUTE)throw Object.defineProperty(Error(`Invariant: app-route received invalid cache entry ${null==T||null==(o=T.value)?void 0:o.kind}`),"__NEXT_ERROR_CODE",{value:"E701",enumerable:!1,configurable:!0});K||t.setHeader("x-nextjs-cache",v?"REVALIDATED":T.isMiss?"MISS":T.isStale?"STALE":"HIT"),X&&t.setHeader("Cache-Control","private, no-cache, no-store, max-age=0, must-revalidate");let d=(0,l.fromNodeOutgoingHttpHeaders)(T.value.headers);return K&&w||d.delete(c.NEXT_CACHE_TAGS_HEADER),!T.cacheControl||t.getHeader("Cache-Control")||d.get("Cache-Control")||d.set("Cache-Control",(0,u.getCacheControlHeader)(T.cacheControl)),await (0,N.sendResponse)($,W,new Response(T.value.body,{headers:d,status:T.value.status||200})),null};H&&q?await o(q):(s=k.getActiveScopeSpan(),await k.withPropagatedContext(e.headers,()=>k.trace(d.BaseServerSpan.handleRequest,{spanName:`${G} ${_}`,kind:n.SpanKind.SERVER,attributes:{"http.method":G,"http.target":e.url}},o),void 0,!H))}catch(t){if(t instanceof L.NoFallbackError||await U.onRequestError(e,t,{routerKind:"App Router",routePath:D,routeType:"route",revalidateReason:(0,p.getRevalidateReason)({isStaticGeneration:M,isOnDemandRevalidate:v})},!1,f),w)throw t;return await (0,N.sendResponse)($,W,new Response(null,{status:500})),null}}e.s(["handler",0,f,"patchFetch",0,function(){return(0,a.patchFetch)({workAsyncStorage:C,workUnitAsyncStorage:X})},"routeModule",0,U,"serverHooks",0,x,"workAsyncStorage",0,C,"workUnitAsyncStorage",0,X],77981)}];

//# sourceMappingURL=%5Broot-of-the-server%5D__0lx4yjp._.js.map