module.exports=[18622,(e,t,r)=>{t.exports=e.x("next/dist/compiled/next-server/app-page-turbo.runtime.prod.js",()=>require("next/dist/compiled/next-server/app-page-turbo.runtime.prod.js"))},56704,(e,t,r)=>{t.exports=e.x("next/dist/server/app-render/work-async-storage.external.js",()=>require("next/dist/server/app-render/work-async-storage.external.js"))},32319,(e,t,r)=>{t.exports=e.x("next/dist/server/app-render/work-unit-async-storage.external.js",()=>require("next/dist/server/app-render/work-unit-async-storage.external.js"))},24725,(e,t,r)=>{t.exports=e.x("next/dist/server/app-render/after-task-async-storage.external.js",()=>require("next/dist/server/app-render/after-task-async-storage.external.js"))},70406,(e,t,r)=>{t.exports=e.x("next/dist/compiled/@opentelemetry/api",()=>require("next/dist/compiled/@opentelemetry/api"))},93695,(e,t,r)=>{t.exports=e.x("next/dist/shared/lib/no-fallback-error.external.js",()=>require("next/dist/shared/lib/no-fallback-error.external.js"))},66680,(e,t,r)=>{t.exports=e.x("node:crypto",()=>require("node:crypto"))},2157,(e,t,r)=>{t.exports=e.x("node:fs",()=>require("node:fs"))},50227,(e,t,r)=>{t.exports=e.x("node:path",()=>require("node:path"))},43793,e=>{"use strict";let t,r;var a,n=e.x("node:sqlite",()=>require("node:sqlite"),!0),s=e.i(66680),o=e.i(2157),i=e.i(50227);let d=process.env.DATA_DIR||i.default.join(process.cwd(),"data");function c(e,t,r,a){e.prepare(`PRAGMA table_info(${t})`).all().some(e=>e.name===r)||e.exec(`ALTER TABLE ${t} ADD COLUMN ${a}`)}let p=globalThis,E=p.__quarkDb??(o.default.mkdirSync(d,{recursive:!0}),(t=new n.DatabaseSync(i.default.join(d,"quark.db"))).exec("PRAGMA busy_timeout = 5000"),t.exec(`
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
  `),c(t,"projects","in_gallery","in_gallery INTEGER NOT NULL DEFAULT 1"),c(t,"projects","platform","platform TEXT NOT NULL DEFAULT 'web' CHECK (platform IN ('web','mobile'))"),c(t,"users","is_demo","is_demo INTEGER NOT NULL DEFAULT 0"),c(t,"jobs","mode","mode TEXT NOT NULL DEFAULT 'fast'"),c(t,"jobs","team","team INTEGER NOT NULL DEFAULT 0"),c(t,"projects","theme","theme TEXT"),c(t,"projects","connectors","connectors TEXT"),c(t,"projects","domain_name","domain_name TEXT"),c(t,"users","credits","credits INTEGER NOT NULL DEFAULT 0"),c(t,"users","plan","plan TEXT NOT NULL DEFAULT 'free'"),c(t,"projects","goal","goal TEXT"),c(t,"projects","goal_active","goal_active INTEGER NOT NULL DEFAULT 0"),c(t,"projects","goal_round","goal_round INTEGER NOT NULL DEFAULT 0"),c(t,"projects","goal_rounds","goal_rounds INTEGER NOT NULL DEFAULT 5"),c(t,"projects","goal_status","goal_status TEXT"),c(t,"projects","acceptance","acceptance TEXT"),c(t,"projects","fused_from","fused_from TEXT"),c(t,"users","username","username TEXT"),r=(a=t).prepare("PRAGMA table_info(users)").all(),r.find(e=>"email"===e.name)?.notnull===1&&(a.exec("PRAGMA foreign_keys = OFF"),a.exec(`
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
         AND NOT EXISTS (SELECT 1 FROM artifacts a WHERE a.project_id = p.id)`).all(),r=e.prepare("INSERT INTO artifacts (id, project_id, version_id, seq, notes, created_at) VALUES (?, ?, ?, 1, ?, ?)");for(let e of t)r.run(`a_${(0,s.randomBytes)(9).toString("base64url")}`,e.project_id,e.version_id,e.prompt,Date.now())}(t),p.__quarkDb=t);e.s(["db",0,E,"now",0,function(){return Date.now()}])},95012,e=>{"use strict";var t=e.i(43793);e.s(["ownedProject",0,function(e,r){return t.db.prepare("SELECT * FROM projects WHERE id = ? AND user_id = ?").get(r,e)}])},24361,(e,t,r)=>{t.exports=e.x("util",()=>require("util"))},22734,(e,t,r)=>{t.exports=e.x("fs",()=>require("fs"))},88947,(e,t,r)=>{t.exports=e.x("stream",()=>require("stream"))},6461,(e,t,r)=>{t.exports=e.x("zlib",()=>require("zlib"))},49719,(e,t,r)=>{t.exports=e.x("assert",()=>require("assert"))},874,(e,t,r)=>{t.exports=e.x("buffer",()=>require("buffer"))},52035,e=>{"use strict";var t=e.i(33189);function r(e,a,n,s=""){var o;let i,d,c=function(e,t=""){return`<script>(function(){var s=${JSON.stringify(e)};var b=${JSON.stringify(t)}+'/api/apps/'+s+'/kv/';window.quark={slug:s,storage:{
get:async function(k){try{var r=await fetch(b+encodeURIComponent(k));if(!r.ok)return null;return (await r.json()).v}catch(e){try{return localStorage.getItem('qk_'+s+'_'+k)}catch(_){return null}}},
set:async function(k,v){try{var r=await fetch(b+encodeURIComponent(k),{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify({v:String(v)})});if(r.ok)return true;throw 0}catch(e){try{localStorage.setItem('qk_'+s+'_'+k,String(v));return true}catch(_){return false}}}}};})()</script>`}(a,s)+(i=process.env.PLATFORM_ORIGIN||"https://quark.lexarcai.com",`<script>(function(){function add(){var d=document.createElement('div');d.style.cssText='position:fixed;right:12px;bottom:12px;z-index:99999;display:flex;align-items:center;gap:6px;background:rgba(13,14,28,.92);color:#edebff;font:12px/1 -apple-system,sans-serif;padding:7px 10px;border-radius:99px;border:1px solid rgba(139,124,255,.35);box-shadow:0 2px 12px rgba(0,0,0,.25)';d.innerHTML='<a href="${i}/remix/${a}" target="_blank" rel="noopener" style="color:#edebff;text-decoration:none">\\u2600 \\u7528 Fusion \\u6784\\u5efa \\u00b7 <span style="color:#8b7cff">Remix</span></a><span style="cursor:pointer;color:#8d8aa8;padding:0 2px" aria-label="\\u5173\\u95ed">\\u00d7</span>';d.lastChild.onclick=function(){d.remove()};document.body.appendChild(d)}if(document.readyState==='loading'){document.addEventListener('DOMContentLoaded',add)}else{add()}})()</script>`)+(0,t.connectorsHelper)((0,t.parseConnectors)(n.connectors),s);return n.snapshot||(c=function(e,t=""){let r=`${t}/api/apps/${e}/report`;return`<script>(function(){var u=${JSON.stringify(r)};var sent=0,seen={};
function post(k,c){try{fetch(u,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({kind:k,content:String(c).slice(0,500)})}).catch(function(){})}catch(e){}}
window.addEventListener('error',function(e){var m=(e&&e.message)||'脚本错误';if(sent>=3||seen[m])return;seen[m]=1;sent++;post('error',m+(e&&e.lineno?' @行'+e.lineno:''))});
window.addEventListener('unhandledrejection',function(e){var m='Promise 拒绝: '+String(e&&e.reason).slice(0,200);if(sent>=3||seen[m])return;seen[m]=1;sent++;post('error',m)});
function add(){var d=document.createElement('div');d.style.cssText='position:fixed;left:12px;bottom:12px;z-index:99998;font:12px/1.4 -apple-system,sans-serif';
var b=document.createElement('button');b.textContent='\\ud83d\\udcac';b.setAttribute('aria-label','\\u53cd\\u9988');b.style.cssText='width:34px;height:34px;border-radius:99px;border:1px solid rgba(139,124,255,.35);background:rgba(13,14,28,.92);color:#edebff;cursor:pointer;box-shadow:0 2px 12px rgba(0,0,0,.25)';
var p=document.createElement('div');p.style.cssText='display:none;position:absolute;left:0;bottom:42px;width:230px;background:rgba(13,14,28,.96);border:1px solid rgba(139,124,255,.35);border-radius:12px;padding:10px;box-shadow:0 4px 20px rgba(0,0,0,.35)';
p.innerHTML='<div style="color:#edebff;margin-bottom:6px">\\u5bf9\\u8fd9\\u4e2a\\u5e94\\u7528\\u7684\\u5efa\\u8bae\\uff1f</div><textarea rows="3" maxlength="500" style="width:100%;box-sizing:border-box;background:#1a1c33;color:#edebff;border:1px solid #333653;border-radius:8px;padding:6px;font:inherit;resize:none"></textarea><div style="display:flex;gap:6px;margin-top:6px;justify-content:flex-end"><button data-x style="background:none;border:none;color:#8d8aa8;cursor:pointer">\\u53d6\\u6d88</button><button data-ok style="background:#8b7cff;border:none;color:#fff;border-radius:8px;padding:5px 12px;cursor:pointer">\\u53d1\\u9001</button></div>';
b.onclick=function(){p.style.display=p.style.display==='none'?'block':'none'};
p.querySelector('[data-x]').onclick=function(){p.style.display='none'};
p.querySelector('[data-ok]').onclick=function(){var t=p.querySelector('textarea');var v=t.value.trim();if(!v)return;post('feedback',v);p.innerHTML='<div style="color:#edebff;padding:4px">\\u2713 \\u5df2\\u6536\\u5230\\uff0c\\u8c22\\u8c22\\u53cd\\u9988\\uff01</div>';setTimeout(function(){p.style.display='none'},1500)};
d.appendChild(p);d.appendChild(b);document.body.appendChild(d)}
if(document.readyState==='loading'){document.addEventListener('DOMContentLoaded',add)}else{add()}})()</script>`}(a,s)+c),"mobile"!==n.platform||s||(c+=(o=!!n.snapshot,d=`<link rel="manifest" href="/api/apps/${a}/manifest.webmanifest">`,/name="theme-color"/i.test(e)||(d+='<meta name="theme-color" content="#0d0e1c">'),/apple-mobile-web-app-capable/i.test(e)||(d+='<meta name="apple-mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">'),o||(d+="<script>if('serviceWorker' in navigator){var p=location.pathname.replace(/\\/$/,'');navigator.serviceWorker.register(p+'/sw.js',{scope:p}).catch(function(){})}</script>"),d)),/<head[^>]*>/i.test(e)?e.replace(/<head([^>]*)>/i,`<head$1>${c}`):c+e}e.s(["exportAppHtml",0,function(e,t,a={}){return r(e,t,a,"https://quark-apps.lexarcai.com")},"notFoundApp",0,function(){return new Response("<h1>404</h1><p>这个应用不存在或已下线。</p>",{status:404,headers:{"content-type":"text/html; charset=utf-8"}})},"serveAppHtml",0,function(e,t,a={}){return new Response(r(e,t,a),{headers:{"content-type":"text/html; charset=utf-8","cache-control":"no-cache"}})}])},81531,(e,t,r)=>{t.exports=e.x("@aws-sdk/client-s3-ecbef8e33fd0b8f0",()=>require("@aws-sdk/client-s3-ecbef8e33fd0b8f0"))},28052,e=>{"use strict";let t;var r=e.i(66680),a=e.i(43793),n=e.i(52035),s=e.i(81531);let o=process.env.AWS_REGION||"us-west-1";function i(){return t??=new s.S3Client({region:o})}async function d(e,t){return await i().send(new s.CreateBucketCommand("us-east-1"===o?{Bucket:e}:{Bucket:e,CreateBucketConfiguration:{LocationConstraint:o}})),await i().send(new s.PutPublicAccessBlockCommand({Bucket:e,PublicAccessBlockConfiguration:{BlockPublicAcls:!1,BlockPublicPolicy:!1,IgnorePublicAcls:!1,RestrictPublicBuckets:!1}})),await i().send(new s.PutBucketPolicyCommand({Bucket:e,Policy:JSON.stringify({Version:"2012-10-17",Statement:[{Sid:"PublicRead",Effect:"Allow",Principal:"*",Action:"s3:GetObject",Resource:`arn:aws:s3:::${e}/*`}]})})),await i().send(new s.PutBucketWebsiteCommand({Bucket:e,WebsiteConfiguration:{IndexDocument:{Suffix:"index.html"},ErrorDocument:{Key:"index.html"}}})),await i().send(new s.PutObjectCommand({Bucket:e,Key:"index.html",Body:t,ContentType:"text/html; charset=utf-8",CacheControl:"no-cache"})),`http://${e}.s3-website-${o}.amazonaws.com`}async function c(e){await i().send(new s.DeleteObjectCommand({Bucket:e,Key:"index.html"})).catch(()=>{}),await i().send(new s.DeleteBucketCommand({Bucket:e}))}function p(e){return a.db.prepare("SELECT * FROM deployments WHERE project_id = ? ORDER BY created_at DESC").all(e).map(e=>({...e}))}async function E(e){let t=`quark-app-${e.slug}-${(0,r.randomBytes)(3).toString("hex")}`,a=(0,n.exportAppHtml)(e.html,e.slug,{platform:e.platform}),s=await d(t,a);return{bucket:t,url:s}}async function l(t){if(!t.token)throw Error("需要 Netlify Personal Access Token");let a=(0,n.exportAppHtml)(t.html,t.slug,{platform:t.platform}),s=await fetch("https://api.netlify.com/api/v1/sites",{method:"POST",headers:{authorization:`Bearer ${t.token}`,"content-type":"application/json"},body:JSON.stringify({name:`quark-${t.slug}-${(0,r.randomBytes)(2).toString("hex")}`})});if(!s.ok)throw Error(`Netlify 建站失败 (${s.status})`);let o=await s.json(),{createHash:i}=await e.A(70729),d=i("sha1").update(a).digest("hex"),c=await fetch(`https://api.netlify.com/api/v1/sites/${o.id}/deploys`,{method:"POST",headers:{authorization:`Bearer ${t.token}`,"content-type":"application/json"},body:JSON.stringify({files:{"/index.html":d}})});if(!c.ok)throw Error(`Netlify 部署失败 (${c.status})`);let p=await c.json(),E=await fetch(`https://api.netlify.com/api/v1/deploys/${p.id}/files/index.html`,{method:"PUT",headers:{authorization:`Bearer ${t.token}`,"content-type":"application/octet-stream"},body:a});if(!E.ok)throw Error(`Netlify 上传失败 (${E.status})`);return{bucket:o.id,url:o.ssl_url||o.url}}async function u(e,t){let n;if("s3"===t)n=await E(e);else if("netlify"===t)n=await l(e);else throw Error("该部署目标暂未开放");let s=`d_${(0,r.randomBytes)(6).toString("base64url")}`;return a.db.prepare("INSERT INTO deployments (id, project_id, artifact_seq, provider, bucket, url, status, created_at) VALUES (?, ?, ?, ?, ?, ?, 'live', ?)").run(s,e.projectId,e.artifactSeq,t,n.bucket,n.url,(0,a.now)()),p(e.projectId)[0]}async function T(e){"s3"===e.provider&&e.bucket&&await c(e.bucket),a.db.prepare("UPDATE deployments SET status = 'removed', removed_at = ? WHERE id = ?").run((0,a.now)(),e.id)}process.env.QUARK_RESOURCE_BUCKET,e.s(["DEPLOY_TARGETS",0,[{id:"local",name:"本机 · Fusion 托管",status:"available",note:"默认。发布即部署到 quark-apps 域,HTTPS + 云存储 + 制品体系"},{id:"s3",name:"AWS S3 静态托管",status:"available",note:"专属 bucket + 网站端点(HTTP)。应用云存储经 CORS 继续可用"},{id:"netlify",name:"Netlify",status:"experimental",note:"使用你自己的 Personal Access Token,仅本次请求使用不存储"},{id:"vercel",name:"Vercel",status:"planned",note:"接口已预留"},{id:"cloudflare",name:"Cloudflare Pages",status:"planned",note:"接口已预留"}],"deployProject",0,u,"listDeployments",0,p,"removeDeployment",0,T],28052)},4373,e=>{"use strict";var t=e.i(47909),r=e.i(74017),a=e.i(96250),n=e.i(59756),s=e.i(61916),o=e.i(74677),i=e.i(69741),d=e.i(16795),c=e.i(87718),p=e.i(95169),E=e.i(47587),l=e.i(66012),u=e.i(70101),T=e.i(26937),N=e.i(10372),m=e.i(93695);e.i(20232);var f=e.i(220),L=e.i(89171),R=e.i(79832),x=e.i(95012),O=e.i(28052);async function _(e,t){let r=await (0,R.getUser)();if(!r)return L.NextResponse.json({error:"未登录"},{status:401});let a=(0,R.demoGuard)(r);if(a)return L.NextResponse.json({error:a},{status:403});let{id:n,depId:s}=await t.params;if(!(0,x.ownedProject)(r.id,n))return L.NextResponse.json({error:"项目不存在"},{status:404});let o=(0,O.listDeployments)(n).find(e=>e.id===s);if(!o||"live"!==o.status)return L.NextResponse.json({error:"部署记录不存在"},{status:404});try{return await (0,O.removeDeployment)(o),L.NextResponse.json({ok:!0})}catch(e){return L.NextResponse.json({error:e instanceof Error?e.message:"下线失败"},{status:502})}}e.s(["DELETE",0,_,"dynamic",0,"force-dynamic"],7196);var h=e.i(7196);let b=new t.AppRouteRouteModule({definition:{kind:r.RouteKind.APP_ROUTE,page:"/api/projects/[id]/deploy/[depId]/route",pathname:"/api/projects/[id]/deploy/[depId]",filename:"route",bundlePath:""},distDir:".next-ci",relativeProjectDir:"",resolvedPagePath:"[project]/src/app/api/projects/[id]/deploy/[depId]/route.ts",nextConfigOutput:"",userland:h,...{}}),{workAsyncStorage:A,workUnitAsyncStorage:I,serverHooks:v}=b;async function y(e,t,a){a.requestMeta&&(0,n.setRequestMeta)(e,a.requestMeta),b.isDev&&(0,n.addRequestMeta)(e,"devRequestTimingInternalsEnd",process.hrtime.bigint());let L="/api/projects/[id]/deploy/[depId]/route";L=L.replace(/\/index$/,"")||"/";let R=await b.prepare(e,t,{srcPage:L,multiZoneDraftMode:!1});if(!R)return t.statusCode=400,t.end("Bad Request"),null==a.waitUntil||a.waitUntil.call(a,Promise.resolve()),null;let{buildId:x,deploymentId:O,params:_,nextConfig:h,parsedUrl:A,isDraftMode:I,prerenderManifest:v,routerServerContext:y,isOnDemandRevalidate:C,revalidateOnlyGenerated:S,resolvedPathname:g,clientReferenceManifest:U,serverActionsManifest:w}=R,X=(0,i.normalizeAppPath)(L),k=!!(v.dynamicRoutes[X]||v.routes[g]),j=async()=>((null==y?void 0:y.render404)?await y.render404(e,t,A,!1):t.end("This page could not be found"),null);if(k&&!I){let e=!!v.routes[g],t=v.dynamicRoutes[X];if(t&&!1===t.fallback&&!e){if(h.adapterPath)return await j();throw new m.NoFallbackError}}let D=null;!k||b.isDev||I||(D="/index"===(D=g)?"/":D);let P=!0===b.isDev||!k,F=k&&!P;w&&U&&(0,o.setManifestsSingleton)({page:L,clientReferenceManifest:U,serverActionsManifest:w});let q=e.method||"GET",B=(0,s.getTracer)(),M=B.getActiveScopeSpan(),G=!!(null==y?void 0:y.isWrappedByNextServer),H=!!(0,n.getRequestMeta)(e,"minimalMode"),$=(0,n.getRequestMeta)(e,"incrementalCache")||await b.getIncrementalCache(e,h,v,H);null==$||$.resetRequestCache(),globalThis.__incrementalCache=$;let K={params:_,previewProps:v.preview,renderOpts:{experimental:{authInterrupts:!!h.experimental.authInterrupts},cacheComponents:!!h.cacheComponents,supportsDynamicResponse:P,incrementalCache:$,cacheLifeProfiles:h.cacheLife,waitUntil:a.waitUntil,onClose:e=>{t.on("close",e)},onAfterTaskError:void 0,onInstrumentationRequestError:(t,r,a,n)=>b.onRequestError(e,t,a,n,y)},sharedContext:{buildId:x,deploymentId:O}},Y=new d.NodeNextRequest(e),W=new d.NodeNextResponse(t),z=c.NextRequestAdapter.fromNodeNextRequest(Y,(0,c.signalFromNodeResponse)(t));try{let n,o=async e=>b.handle(z,K).finally(()=>{if(!e)return;e.setAttributes({"http.status_code":t.statusCode,"next.rsc":!1});let r=B.getRootSpanAttributes();if(!r)return;if(r.get("next.span_type")!==p.BaseServerSpan.handleRequest)return void console.warn(`Unexpected root span type '${r.get("next.span_type")}'. Please report this Next.js issue https://github.com/vercel/next.js`);let a=r.get("next.route");if(a){let t=`${q} ${a}`;e.setAttributes({"next.route":a,"http.route":a,"next.span_name":t}),e.updateName(t),n&&n!==e&&(n.setAttribute("http.route",a),n.updateName(t))}else e.updateName(`${q} ${L}`)}),i=async n=>{var s,i;let d=async({previousCacheEntry:r})=>{try{if(!H&&C&&S&&!r)return t.statusCode=404,t.setHeader("x-nextjs-cache","REVALIDATED"),t.end("This page could not be found"),null;let s=await o(n);e.fetchMetrics=K.renderOpts.fetchMetrics;let i=K.renderOpts.pendingWaitUntil;i&&a.waitUntil&&(a.waitUntil(i),i=void 0);let d=K.renderOpts.collectedTags;if(!k)return await (0,l.sendResponse)(Y,W,s,K.renderOpts.pendingWaitUntil),null;{let e=await s.blob(),t=(0,u.toNodeOutgoingHttpHeaders)(s.headers);d&&(t[N.NEXT_CACHE_TAGS_HEADER]=d),!t["content-type"]&&e.type&&(t["content-type"]=e.type);let r=void 0!==K.renderOpts.collectedRevalidate&&!(K.renderOpts.collectedRevalidate>=N.INFINITE_CACHE)&&K.renderOpts.collectedRevalidate,a=void 0===K.renderOpts.collectedExpire||K.renderOpts.collectedExpire>=N.INFINITE_CACHE?void 0:K.renderOpts.collectedExpire;return{value:{kind:f.CachedRouteKind.APP_ROUTE,status:s.status,body:Buffer.from(await e.arrayBuffer()),headers:t},cacheControl:{revalidate:r,expire:a}}}}catch(t){throw(null==r?void 0:r.isStale)&&await b.onRequestError(e,t,{routerKind:"App Router",routePath:L,routeType:"route",revalidateReason:(0,E.getRevalidateReason)({isStaticGeneration:F,isOnDemandRevalidate:C})},!1,y),t}},c=await b.handleResponse({req:e,nextConfig:h,cacheKey:D,routeKind:r.RouteKind.APP_ROUTE,isFallback:!1,prerenderManifest:v,isRoutePPREnabled:!1,isOnDemandRevalidate:C,revalidateOnlyGenerated:S,responseGenerator:d,waitUntil:a.waitUntil,isMinimalMode:H});if(!k)return null;if((null==c||null==(s=c.value)?void 0:s.kind)!==f.CachedRouteKind.APP_ROUTE)throw Object.defineProperty(Error(`Invariant: app-route received invalid cache entry ${null==c||null==(i=c.value)?void 0:i.kind}`),"__NEXT_ERROR_CODE",{value:"E701",enumerable:!1,configurable:!0});H||t.setHeader("x-nextjs-cache",C?"REVALIDATED":c.isMiss?"MISS":c.isStale?"STALE":"HIT"),I&&t.setHeader("Cache-Control","private, no-cache, no-store, max-age=0, must-revalidate");let p=(0,u.fromNodeOutgoingHttpHeaders)(c.value.headers);return H&&k||p.delete(N.NEXT_CACHE_TAGS_HEADER),!c.cacheControl||t.getHeader("Cache-Control")||p.get("Cache-Control")||p.set("Cache-Control",(0,T.getCacheControlHeader)(c.cacheControl)),await (0,l.sendResponse)(Y,W,new Response(c.value.body,{headers:p,status:c.value.status||200})),null};G&&M?await i(M):(n=B.getActiveScopeSpan(),await B.withPropagatedContext(e.headers,()=>B.trace(p.BaseServerSpan.handleRequest,{spanName:`${q} ${L}`,kind:s.SpanKind.SERVER,attributes:{"http.method":q,"http.target":e.url}},i),void 0,!G))}catch(t){if(t instanceof m.NoFallbackError||await b.onRequestError(e,t,{routerKind:"App Router",routePath:X,routeType:"route",revalidateReason:(0,E.getRevalidateReason)({isStaticGeneration:F,isOnDemandRevalidate:C})},!1,y),k)throw t;return await (0,l.sendResponse)(Y,W,new Response(null,{status:500})),null}}e.s(["handler",0,y,"patchFetch",0,function(){return(0,a.patchFetch)({workAsyncStorage:A,workUnitAsyncStorage:I})},"routeModule",0,b,"serverHooks",0,v,"workAsyncStorage",0,A,"workUnitAsyncStorage",0,I],4373)},70729,e=>{e.v(e=>Promise.resolve().then(()=>e(66680)))}];

//# sourceMappingURL=%5Broot-of-the-server%5D__1k4nc2q._.js.map