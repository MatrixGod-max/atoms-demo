module.exports=[18622,(e,t,r)=>{t.exports=e.x("next/dist/compiled/next-server/app-page-turbo.runtime.prod.js",()=>require("next/dist/compiled/next-server/app-page-turbo.runtime.prod.js"))},56704,(e,t,r)=>{t.exports=e.x("next/dist/server/app-render/work-async-storage.external.js",()=>require("next/dist/server/app-render/work-async-storage.external.js"))},32319,(e,t,r)=>{t.exports=e.x("next/dist/server/app-render/work-unit-async-storage.external.js",()=>require("next/dist/server/app-render/work-unit-async-storage.external.js"))},24725,(e,t,r)=>{t.exports=e.x("next/dist/server/app-render/after-task-async-storage.external.js",()=>require("next/dist/server/app-render/after-task-async-storage.external.js"))},70406,(e,t,r)=>{t.exports=e.x("next/dist/compiled/@opentelemetry/api",()=>require("next/dist/compiled/@opentelemetry/api"))},93695,(e,t,r)=>{t.exports=e.x("next/dist/shared/lib/no-fallback-error.external.js",()=>require("next/dist/shared/lib/no-fallback-error.external.js"))},66680,(e,t,r)=>{t.exports=e.x("node:crypto",()=>require("node:crypto"))},2157,(e,t,r)=>{t.exports=e.x("node:fs",()=>require("node:fs"))},50227,(e,t,r)=>{t.exports=e.x("node:path",()=>require("node:path"))},43793,e=>{"use strict";let t,r;var a,n=e.x("node:sqlite",()=>require("node:sqlite"),!0),s=e.i(66680),o=e.i(2157),i=e.i(50227);let d=process.env.DATA_DIR||i.default.join(process.cwd(),"data");function p(e,t,r,a){e.prepare(`PRAGMA table_info(${t})`).all().some(e=>e.name===r)||e.exec(`ALTER TABLE ${t} ADD COLUMN ${a}`)}let E=globalThis,c=E.__quarkDb??(o.default.mkdirSync(d,{recursive:!0}),(t=new n.DatabaseSync(i.default.join(d,"quark.db"))).exec("PRAGMA busy_timeout = 5000"),t.exec(`
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
  `),p(t,"projects","in_gallery","in_gallery INTEGER NOT NULL DEFAULT 1"),p(t,"projects","platform","platform TEXT NOT NULL DEFAULT 'web' CHECK (platform IN ('web','mobile'))"),p(t,"users","is_demo","is_demo INTEGER NOT NULL DEFAULT 0"),p(t,"jobs","mode","mode TEXT NOT NULL DEFAULT 'fast'"),p(t,"jobs","team","team INTEGER NOT NULL DEFAULT 0"),p(t,"projects","theme","theme TEXT"),p(t,"projects","connectors","connectors TEXT"),p(t,"projects","domain_name","domain_name TEXT"),p(t,"users","credits","credits INTEGER NOT NULL DEFAULT 0"),p(t,"users","plan","plan TEXT NOT NULL DEFAULT 'free'"),p(t,"projects","goal","goal TEXT"),p(t,"projects","goal_active","goal_active INTEGER NOT NULL DEFAULT 0"),p(t,"projects","goal_round","goal_round INTEGER NOT NULL DEFAULT 0"),p(t,"projects","goal_rounds","goal_rounds INTEGER NOT NULL DEFAULT 5"),p(t,"projects","goal_status","goal_status TEXT"),p(t,"projects","acceptance","acceptance TEXT"),p(t,"projects","fused_from","fused_from TEXT"),p(t,"users","username","username TEXT"),r=(a=t).prepare("PRAGMA table_info(users)").all(),r.find(e=>"email"===e.name)?.notnull===1&&(a.exec("PRAGMA foreign_keys = OFF"),a.exec(`
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
         AND NOT EXISTS (SELECT 1 FROM artifacts a WHERE a.project_id = p.id)`).all(),r=e.prepare("INSERT INTO artifacts (id, project_id, version_id, seq, notes, created_at) VALUES (?, ?, ?, 1, ?, ?)");for(let e of t)r.run(`a_${(0,s.randomBytes)(9).toString("base64url")}`,e.project_id,e.version_id,e.prompt,Date.now())}(t),E.__quarkDb=t);e.s(["db",0,c,"now",0,function(){return Date.now()}])},95012,e=>{"use strict";var t=e.i(43793);e.s(["ownedProject",0,function(e,r){return t.db.prepare("SELECT * FROM projects WHERE id = ? AND user_id = ?").get(r,e)}])},68362,e=>{"use strict";var t=e.i(66680),r=e.i(43793);function a(e,a,n){r.db.prepare("UPDATE users SET credits = credits + ? WHERE id = ?").run(a,e),r.db.prepare("INSERT INTO credit_events (id, user_id, delta, reason, created_at) VALUES (?, ?, ?, ?, ?)").run(`ce_${(0,t.randomBytes)(8).toString("base64url")}`,e,a,n,(0,r.now)())}function n(e,t){return!!r.db.prepare("SELECT 1 FROM credit_events WHERE user_id = ? AND reason = ?").get(e,t)}let s={free:0,pro:100,max:400};e.s(["BANNER_BONUS",0,26,"PLANS",0,["free","pro","max"],"SIGNUP_BONUS",0,20,"balance",0,function(e){let t=r.db.prepare("SELECT credits FROM users WHERE id = ?").get(e);return t?.credits??0},"charge",0,function(e,a,n){return 0!==Number(r.db.prepare("UPDATE users SET credits = credits - ? WHERE id = ? AND credits >= ?").run(a,e,a).changes)&&(r.db.prepare("INSERT INTO credit_events (id, user_id, delta, reason, created_at) VALUES (?, ?, ?, ?, ?)").run(`ce_${(0,t.randomBytes)(8).toString("base64url")}`,e,-a,n,(0,r.now)()),!0)},"generationCost",0,function(e,t,r,a=!1){return("deep"===e?5:"mixed"===e?3:1)+ +!!t+ +!!r+2*!!a},"hasClaimed",0,n,"recentEvents",0,function(e,t=20){return r.db.prepare("SELECT delta, reason, created_at FROM credit_events WHERE user_id = ? ORDER BY created_at DESC LIMIT ?").all(e,t).map(e=>({...e}))},"recordEvent",0,a,"redeemCode",0,function(e,t){let n=t.trim().toUpperCase(),s=r.db.prepare("SELECT amount, used_by FROM redeem_codes WHERE code = ?").get(n);return s?s.used_by||0===Number(r.db.prepare("UPDATE redeem_codes SET used_by = ?, used_at = ? WHERE code = ? AND used_by IS NULL").run(e,(0,r.now)(),n).changes)?{ok:!1,error:"该兑换码已被使用"}:(a(e,s.amount,`redeem:${n}`),{ok:!0,amount:s.amount}):{ok:!1,error:"兑换码不存在"}},"switchPlan",0,function(e,t){let o=r.db.prepare("SELECT plan FROM users WHERE id = ?").get(e);if(!o)return{ok:!1,error:"用户不存在"};if(o.plan===t)return{ok:!1,error:"已是当前套餐"};r.db.prepare("UPDATE users SET plan = ? WHERE id = ?").run(t,e);let i=`plan:${t}`;return s[t]>0&&!n(e,i)?(a(e,s[t],i),{ok:!0,bonus:s[t]}):{ok:!0,bonus:0}}])},83159,e=>{"use strict";var t=e.i(43793);let r=new Set(["text/plain","text/markdown","text/csv","application/json"]),a=new Set(["image/png","image/jpeg","image/webp","image/svg+xml"]);function n(e){return r.has(e)?"text":a.has(e)?"image":null}e.s(["attachmentKind",0,n,"inlineImageAssets",0,function(e,t){let r=e;for(let e of t)"image"===e.kind&&e.dataUri&&(r=r.split(`asset://${e.filename}`).join(e.dataUri));return r},"listAttachments",0,function(e){return t.db.prepare("SELECT id, filename, mime, kind, size FROM attachments WHERE project_id = ? ORDER BY created_at").all(e).map(e=>({...e}))},"loadPipelineAttachments",0,function(e){return t.db.prepare("SELECT filename, mime, kind, data FROM attachments WHERE project_id = ? ORDER BY created_at").all(e).map(e=>{let t=Buffer.from(e.data);return"text"===e.kind?{filename:e.filename,kind:e.kind,mime:e.mime,text:t.toString("utf8")}:{filename:e.filename,kind:e.kind,mime:e.mime,dataUri:`data:${e.mime};base64,${t.toString("base64")}`}})},"validateAttachment",0,function(e,t,r){let a=n(e);if(!a)return"仅支持文本(txt/md/csv/json)与图片(png/jpg/webp/svg)";if(r>=6)return"每个项目最多 6 个附件";let s="text"===a?65536:524288;return t>s?`${"text"===a?"文本":"图片"}附件不能超过 ${s/1024}KB`:0===t?"文件为空":null}])},24361,(e,t,r)=>{t.exports=e.x("util",()=>require("util"))},22734,(e,t,r)=>{t.exports=e.x("fs",()=>require("fs"))},88947,(e,t,r)=>{t.exports=e.x("stream",()=>require("stream"))},6461,(e,t,r)=>{t.exports=e.x("zlib",()=>require("zlib"))},49719,(e,t,r)=>{t.exports=e.x("assert",()=>require("assert"))},874,(e,t,r)=>{t.exports=e.x("buffer",()=>require("buffer"))},52035,e=>{"use strict";var t=e.i(33189);function r(e,a,n,s=""){var o;let i,d,p=function(e,t=""){return`<script>(function(){var s=${JSON.stringify(e)};var b=${JSON.stringify(t)}+'/api/apps/'+s+'/kv/';window.quark={slug:s,storage:{
get:async function(k){try{var r=await fetch(b+encodeURIComponent(k));if(!r.ok)return null;return (await r.json()).v}catch(e){try{return localStorage.getItem('qk_'+s+'_'+k)}catch(_){return null}}},
set:async function(k,v){try{var r=await fetch(b+encodeURIComponent(k),{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify({v:String(v)})});if(r.ok)return true;throw 0}catch(e){try{localStorage.setItem('qk_'+s+'_'+k,String(v));return true}catch(_){return false}}}}};})()</script>`}(a,s)+(i=process.env.PLATFORM_ORIGIN||"https://quark.lexarcai.com",`<script>(function(){function add(){var d=document.createElement('div');d.style.cssText='position:fixed;right:12px;bottom:12px;z-index:99999;display:flex;align-items:center;gap:6px;background:rgba(13,14,28,.92);color:#edebff;font:12px/1 -apple-system,sans-serif;padding:7px 10px;border-radius:99px;border:1px solid rgba(139,124,255,.35);box-shadow:0 2px 12px rgba(0,0,0,.25)';d.innerHTML='<a href="${i}/remix/${a}" target="_blank" rel="noopener" style="color:#edebff;text-decoration:none">\\u2600 \\u7528 Fusion \\u6784\\u5efa \\u00b7 <span style="color:#8b7cff">Remix</span></a><span style="cursor:pointer;color:#8d8aa8;padding:0 2px" aria-label="\\u5173\\u95ed">\\u00d7</span>';d.lastChild.onclick=function(){d.remove()};document.body.appendChild(d)}if(document.readyState==='loading'){document.addEventListener('DOMContentLoaded',add)}else{add()}})()</script>`)+(0,t.connectorsHelper)((0,t.parseConnectors)(n.connectors),s);return n.snapshot||(p=function(e,t=""){let r=`${t}/api/apps/${e}/report`;return`<script>(function(){var u=${JSON.stringify(r)};var sent=0,seen={};
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
if(document.readyState==='loading'){document.addEventListener('DOMContentLoaded',add)}else{add()}})()</script>`}(a,s)+p),"mobile"!==n.platform||s||(p+=(o=!!n.snapshot,d=`<link rel="manifest" href="/api/apps/${a}/manifest.webmanifest">`,/name="theme-color"/i.test(e)||(d+='<meta name="theme-color" content="#0d0e1c">'),/apple-mobile-web-app-capable/i.test(e)||(d+='<meta name="apple-mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">'),o||(d+="<script>if('serviceWorker' in navigator){var p=location.pathname.replace(/\\/$/,'');navigator.serviceWorker.register(p+'/sw.js',{scope:p}).catch(function(){})}</script>"),d)),/<head[^>]*>/i.test(e)?e.replace(/<head([^>]*)>/i,`<head$1>${p}`):p+e}e.s(["exportAppHtml",0,function(e,t,a={}){return r(e,t,a,"https://quark-apps.lexarcai.com")},"notFoundApp",0,function(){return new Response("<h1>404</h1><p>这个应用不存在或已下线。</p>",{status:404,headers:{"content-type":"text/html; charset=utf-8"}})},"serveAppHtml",0,function(e,t,a={}){return new Response(r(e,t,a),{headers:{"content-type":"text/html; charset=utf-8","cache-control":"no-cache"}})}])},81531,(e,t,r)=>{t.exports=e.x("@aws-sdk/client-s3-ecbef8e33fd0b8f0",()=>require("@aws-sdk/client-s3-ecbef8e33fd0b8f0"))},28052,e=>{"use strict";let t;var r=e.i(66680),a=e.i(43793),n=e.i(52035),s=e.i(81531);let o=process.env.AWS_REGION||"us-west-1";function i(){return t??=new s.S3Client({region:o})}async function d(e,t){return await i().send(new s.CreateBucketCommand("us-east-1"===o?{Bucket:e}:{Bucket:e,CreateBucketConfiguration:{LocationConstraint:o}})),await i().send(new s.PutPublicAccessBlockCommand({Bucket:e,PublicAccessBlockConfiguration:{BlockPublicAcls:!1,BlockPublicPolicy:!1,IgnorePublicAcls:!1,RestrictPublicBuckets:!1}})),await i().send(new s.PutBucketPolicyCommand({Bucket:e,Policy:JSON.stringify({Version:"2012-10-17",Statement:[{Sid:"PublicRead",Effect:"Allow",Principal:"*",Action:"s3:GetObject",Resource:`arn:aws:s3:::${e}/*`}]})})),await i().send(new s.PutBucketWebsiteCommand({Bucket:e,WebsiteConfiguration:{IndexDocument:{Suffix:"index.html"},ErrorDocument:{Key:"index.html"}}})),await i().send(new s.PutObjectCommand({Bucket:e,Key:"index.html",Body:t,ContentType:"text/html; charset=utf-8",CacheControl:"no-cache"})),`http://${e}.s3-website-${o}.amazonaws.com`}async function p(e){await i().send(new s.DeleteObjectCommand({Bucket:e,Key:"index.html"})).catch(()=>{}),await i().send(new s.DeleteBucketCommand({Bucket:e}))}function E(e){return a.db.prepare("SELECT * FROM deployments WHERE project_id = ? ORDER BY created_at DESC").all(e).map(e=>({...e}))}async function c(e){let t=`quark-app-${e.slug}-${(0,r.randomBytes)(3).toString("hex")}`,a=(0,n.exportAppHtml)(e.html,e.slug,{platform:e.platform}),s=await d(t,a);return{bucket:t,url:s}}async function u(t){if(!t.token)throw Error("需要 Netlify Personal Access Token");let a=(0,n.exportAppHtml)(t.html,t.slug,{platform:t.platform}),s=await fetch("https://api.netlify.com/api/v1/sites",{method:"POST",headers:{authorization:`Bearer ${t.token}`,"content-type":"application/json"},body:JSON.stringify({name:`quark-${t.slug}-${(0,r.randomBytes)(2).toString("hex")}`})});if(!s.ok)throw Error(`Netlify 建站失败 (${s.status})`);let o=await s.json(),{createHash:i}=await e.A(70729),d=i("sha1").update(a).digest("hex"),p=await fetch(`https://api.netlify.com/api/v1/sites/${o.id}/deploys`,{method:"POST",headers:{authorization:`Bearer ${t.token}`,"content-type":"application/json"},body:JSON.stringify({files:{"/index.html":d}})});if(!p.ok)throw Error(`Netlify 部署失败 (${p.status})`);let E=await p.json(),c=await fetch(`https://api.netlify.com/api/v1/deploys/${E.id}/files/index.html`,{method:"PUT",headers:{authorization:`Bearer ${t.token}`,"content-type":"application/octet-stream"},body:a});if(!c.ok)throw Error(`Netlify 上传失败 (${c.status})`);return{bucket:o.id,url:o.ssl_url||o.url}}async function l(e,t){let n;if("s3"===t)n=await c(e);else if("netlify"===t)n=await u(e);else throw Error("该部署目标暂未开放");let s=`d_${(0,r.randomBytes)(6).toString("base64url")}`;return a.db.prepare("INSERT INTO deployments (id, project_id, artifact_seq, provider, bucket, url, status, created_at) VALUES (?, ?, ?, ?, ?, ?, 'live', ?)").run(s,e.projectId,e.artifactSeq,t,n.bucket,n.url,(0,a.now)()),E(e.projectId)[0]}async function T(e){"s3"===e.provider&&e.bucket&&await p(e.bucket),a.db.prepare("UPDATE deployments SET status = 'removed', removed_at = ? WHERE id = ?").run((0,a.now)(),e.id)}process.env.QUARK_RESOURCE_BUCKET,e.s(["DEPLOY_TARGETS",0,[{id:"local",name:"本机 · Fusion 托管",status:"available",note:"默认。发布即部署到 quark-apps 域,HTTPS + 云存储 + 制品体系"},{id:"s3",name:"AWS S3 静态托管",status:"available",note:"专属 bucket + 网站端点(HTTP)。应用云存储经 CORS 继续可用"},{id:"netlify",name:"Netlify",status:"experimental",note:"使用你自己的 Personal Access Token,仅本次请求使用不存储"},{id:"vercel",name:"Vercel",status:"planned",note:"接口已预留"},{id:"cloudflare",name:"Cloudflare Pages",status:"planned",note:"接口已预留"}],"deployProject",0,l,"listDeployments",0,E,"removeDeployment",0,T],28052)},59220,e=>{"use strict";let t=process.env.APPS_HOST||"quark-apps.lexarcai.com",r=new Set(["www","api","app","apps","admin","root","mail","smtp","ftp","dev","test","staging","quark","fusion","atoms","demo","static","cdn","assets","help","docs","blog","status"]);e.s(["APP_DOMAIN_SUFFIX",0,t,"validateDomainName",0,function(e){return/^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$/.test(e)?r.has(e)?"该名称为系统保留,请换一个":null:"域名需为 3-30 位小写字母/数字/中划线,不能以中划线开头或结尾"}])},54701,e=>e.a(async(t,r)=>{try{var a=e.i(89171),n=e.i(43793),s=e.i(79832),o=e.i(95012),i=e.i(83555),d=e.i(83159),p=e.i(28052),E=e.i(59220),c=e.i(33189),u=t([i]);async function l(e,t){let r=await (0,s.getUser)();if(!r)return a.NextResponse.json({error:"未登录"},{status:401});let{id:E}=await t.params,c=(0,o.ownedProject)(r.id,E);if(!c)return a.NextResponse.json({error:"项目不存在"},{status:404});let u=n.db.prepare("SELECT id, role, content, meta, created_at FROM messages WHERE project_id = ? ORDER BY created_at").all(E),l=n.db.prepare("SELECT id, num, review_notes, prompt, created_at, LENGTH(html) AS size FROM app_versions WHERE project_id = ? ORDER BY num").all(E),T=c.current_version_id?n.db.prepare("SELECT html FROM app_versions WHERE id = ?").get(c.current_version_id):void 0,N=i.jobRunner.activeJobForProject(E);return a.NextResponse.json({project:c,messages:u,versions:l,currentHtml:T?.html??null,attachments:(0,d.listAttachments)(E),deployments:(0,p.listDeployments)(E),deployTargets:p.DEPLOY_TARGETS,activeJob:N?{id:N.id,status:N.status,stage:N.stage}:null})}async function T(e,t){let r=await (0,s.getUser)();if(!r)return a.NextResponse.json({error:"未登录"},{status:401});let i=(0,s.demoGuard)(r);if(i)return a.NextResponse.json({error:i},{status:403});let{id:d}=await t.params;if(!(0,o.ownedProject)(r.id,d))return a.NextResponse.json({error:"项目不存在"},{status:404});let{name:p,inGallery:u,platform:l,theme:T,connectors:N,domainName:m,goal:f,goalRounds:R,goalActive:L}=await e.json().catch(()=>({}));if("string"==typeof p&&p.trim()&&n.db.prepare("UPDATE projects SET name = ?, updated_at = ? WHERE id = ?").run(p.trim().slice(0,40),(0,n.now)(),d),(null===T||"string"==typeof T&&T.trim())&&n.db.prepare("UPDATE projects SET theme = ?, updated_at = ? WHERE id = ?").run(null===T?null:T.trim().slice(0,20),(0,n.now)(),d),("web"===l||"mobile"===l)&&n.db.prepare("UPDATE projects SET platform = ?, updated_at = ? WHERE id = ?").run(l,(0,n.now)(),d),Array.isArray(N)){let e=N.filter(e=>c.CONNECTORS.some(t=>t.id===e)).slice(0,5);n.db.prepare("UPDATE projects SET connectors = ?, updated_at = ? WHERE id = ?").run(e.length?JSON.stringify(e):null,(0,n.now)(),d)}if(null===m)n.db.prepare("UPDATE projects SET domain_name = NULL, updated_at = ? WHERE id = ?").run((0,n.now)(),d);else if("string"==typeof m){let e=m.trim().toLowerCase(),t=(0,E.validateDomainName)(e);if(t)return a.NextResponse.json({error:t},{status:400});if(n.db.prepare("SELECT 1 FROM projects WHERE domain_name = ? AND id != ?").get(e,d))return a.NextResponse.json({error:"该域名已被占用,请换一个"},{status:409});n.db.prepare("UPDATE projects SET domain_name = ?, updated_at = ? WHERE id = ?").run(e,(0,n.now)(),d)}return"boolean"==typeof u&&n.db.prepare("UPDATE projects SET in_gallery = ? WHERE id = ?").run(+!!u,d),null===f?n.db.prepare("UPDATE projects SET goal = NULL, goal_status = NULL, goal_round = 0, updated_at = ? WHERE id = ?").run((0,n.now)(),d):"string"==typeof f&&f.trim()&&n.db.prepare("UPDATE projects SET goal = ?, updated_at = ? WHERE id = ?").run(f.trim().slice(0,500),(0,n.now)(),d),"number"==typeof R&&Number.isFinite(R)&&n.db.prepare("UPDATE projects SET goal_rounds = ?, updated_at = ? WHERE id = ?").run(Math.max(1,Math.min(10,Math.round(R))),(0,n.now)(),d),!1===L&&n.db.prepare("UPDATE projects SET goal_status = CASE WHEN goal_active = 1 THEN 'stopped' ELSE goal_status END, goal_active = 0, updated_at = ? WHERE id = ?").run((0,n.now)(),d),a.NextResponse.json({ok:!0})}async function N(e,t){let r=await (0,s.getUser)();if(!r)return a.NextResponse.json({error:"未登录"},{status:401});let i=(0,s.demoGuard)(r);if(i)return a.NextResponse.json({error:i},{status:403});let{id:d}=await t.params;return(0,o.ownedProject)(r.id,d)?(n.db.prepare("DELETE FROM projects WHERE id = ?").run(d),a.NextResponse.json({ok:!0})):a.NextResponse.json({error:"项目不存在"},{status:404})}[i]=u.then?(await u)():u,e.s(["DELETE",0,N,"GET",0,l,"PATCH",0,T]),r()}catch(e){r(e)}},!1),70457,e=>e.a(async(t,r)=>{try{var a=e.i(47909),n=e.i(74017),s=e.i(96250),o=e.i(59756),i=e.i(61916),d=e.i(74677),p=e.i(69741),E=e.i(16795),c=e.i(87718),u=e.i(95169),l=e.i(47587),T=e.i(66012),N=e.i(70101),m=e.i(26937),f=e.i(10372),R=e.i(93695);e.i(20232);var L=e.i(220),_=e.i(54701),b=t([_]);[_]=b.then?(await b)():b;let O=new a.AppRouteRouteModule({definition:{kind:n.RouteKind.APP_ROUTE,page:"/api/projects/[id]/route",pathname:"/api/projects/[id]",filename:"route",bundlePath:""},distDir:".next-ci",relativeProjectDir:"",resolvedPagePath:"[project]/src/app/api/projects/[id]/route.ts",nextConfigOutput:"",userland:_,...{}}),{workAsyncStorage:h,workUnitAsyncStorage:A,serverHooks:S}=O;async function x(e,t,r){r.requestMeta&&(0,o.setRequestMeta)(e,r.requestMeta),O.isDev&&(0,o.addRequestMeta)(e,"devRequestTimingInternalsEnd",process.hrtime.bigint());let a="/api/projects/[id]/route";a=a.replace(/\/index$/,"")||"/";let s=await O.prepare(e,t,{srcPage:a,multiZoneDraftMode:!1});if(!s)return t.statusCode=400,t.end("Bad Request"),null==r.waitUntil||r.waitUntil.call(r,Promise.resolve()),null;let{buildId:_,deploymentId:b,params:x,nextConfig:h,parsedUrl:A,isDraftMode:S,prerenderManifest:g,routerServerContext:v,isOnDemandRevalidate:C,revalidateOnlyGenerated:y,resolvedPathname:I,clientReferenceManifest:U,serverActionsManifest:w}=s,j=(0,p.normalizeAppPath)(a),k=!!(g.dynamicRoutes[j]||g.routes[I]),X=async()=>((null==v?void 0:v.render404)?await v.render404(e,t,A,!1):t.end("This page could not be found"),null);if(k&&!S){let e=!!g.routes[I],t=g.dynamicRoutes[j];if(t&&!1===t.fallback&&!e){if(h.adapterPath)return await X();throw new R.NoFallbackError}}let D=null;!k||O.isDev||S||(D=I,D="/index"===D?"/":D);let P=!0===O.isDev||!k,F=k&&!P;w&&U&&(0,d.setManifestsSingleton)({page:a,clientReferenceManifest:U,serverActionsManifest:w});let H=e.method||"GET",M=(0,i.getTracer)(),B=M.getActiveScopeSpan(),q=!!(null==v?void 0:v.isWrappedByNextServer),G=!!(0,o.getRequestMeta)(e,"minimalMode"),$=(0,o.getRequestMeta)(e,"incrementalCache")||await O.getIncrementalCache(e,h,g,G);null==$||$.resetRequestCache(),globalThis.__incrementalCache=$;let W={params:x,previewProps:g.preview,renderOpts:{experimental:{authInterrupts:!!h.experimental.authInterrupts},cacheComponents:!!h.cacheComponents,supportsDynamicResponse:P,incrementalCache:$,cacheLifeProfiles:h.cacheLife,waitUntil:r.waitUntil,onClose:e=>{t.on("close",e)},onAfterTaskError:void 0,onInstrumentationRequestError:(t,r,a,n)=>O.onRequestError(e,t,a,n,v)},sharedContext:{buildId:_,deploymentId:b}},K=new E.NodeNextRequest(e),Y=new E.NodeNextResponse(t),z=c.NextRequestAdapter.fromNodeNextRequest(K,(0,c.signalFromNodeResponse)(t));try{let s,o=async e=>O.handle(z,W).finally(()=>{if(!e)return;e.setAttributes({"http.status_code":t.statusCode,"next.rsc":!1});let r=M.getRootSpanAttributes();if(!r)return;if(r.get("next.span_type")!==u.BaseServerSpan.handleRequest)return void console.warn(`Unexpected root span type '${r.get("next.span_type")}'. Please report this Next.js issue https://github.com/vercel/next.js`);let n=r.get("next.route");if(n){let t=`${H} ${n}`;e.setAttributes({"next.route":n,"http.route":n,"next.span_name":t}),e.updateName(t),s&&s!==e&&(s.setAttribute("http.route",n),s.updateName(t))}else e.updateName(`${H} ${a}`)}),d=async s=>{var i,d;let p=async({previousCacheEntry:n})=>{try{if(!G&&C&&y&&!n)return t.statusCode=404,t.setHeader("x-nextjs-cache","REVALIDATED"),t.end("This page could not be found"),null;let a=await o(s);e.fetchMetrics=W.renderOpts.fetchMetrics;let i=W.renderOpts.pendingWaitUntil;i&&r.waitUntil&&(r.waitUntil(i),i=void 0);let d=W.renderOpts.collectedTags;if(!k)return await (0,T.sendResponse)(K,Y,a,W.renderOpts.pendingWaitUntil),null;{let e=await a.blob(),t=(0,N.toNodeOutgoingHttpHeaders)(a.headers);d&&(t[f.NEXT_CACHE_TAGS_HEADER]=d),!t["content-type"]&&e.type&&(t["content-type"]=e.type);let r=void 0!==W.renderOpts.collectedRevalidate&&!(W.renderOpts.collectedRevalidate>=f.INFINITE_CACHE)&&W.renderOpts.collectedRevalidate,n=void 0===W.renderOpts.collectedExpire||W.renderOpts.collectedExpire>=f.INFINITE_CACHE?void 0:W.renderOpts.collectedExpire;return{value:{kind:L.CachedRouteKind.APP_ROUTE,status:a.status,body:Buffer.from(await e.arrayBuffer()),headers:t},cacheControl:{revalidate:r,expire:n}}}}catch(t){throw(null==n?void 0:n.isStale)&&await O.onRequestError(e,t,{routerKind:"App Router",routePath:a,routeType:"route",revalidateReason:(0,l.getRevalidateReason)({isStaticGeneration:F,isOnDemandRevalidate:C})},!1,v),t}},E=await O.handleResponse({req:e,nextConfig:h,cacheKey:D,routeKind:n.RouteKind.APP_ROUTE,isFallback:!1,prerenderManifest:g,isRoutePPREnabled:!1,isOnDemandRevalidate:C,revalidateOnlyGenerated:y,responseGenerator:p,waitUntil:r.waitUntil,isMinimalMode:G});if(!k)return null;if((null==E||null==(i=E.value)?void 0:i.kind)!==L.CachedRouteKind.APP_ROUTE)throw Object.defineProperty(Error(`Invariant: app-route received invalid cache entry ${null==E||null==(d=E.value)?void 0:d.kind}`),"__NEXT_ERROR_CODE",{value:"E701",enumerable:!1,configurable:!0});G||t.setHeader("x-nextjs-cache",C?"REVALIDATED":E.isMiss?"MISS":E.isStale?"STALE":"HIT"),S&&t.setHeader("Cache-Control","private, no-cache, no-store, max-age=0, must-revalidate");let c=(0,N.fromNodeOutgoingHttpHeaders)(E.value.headers);return G&&k||c.delete(f.NEXT_CACHE_TAGS_HEADER),!E.cacheControl||t.getHeader("Cache-Control")||c.get("Cache-Control")||c.set("Cache-Control",(0,m.getCacheControlHeader)(E.cacheControl)),await (0,T.sendResponse)(K,Y,new Response(E.value.body,{headers:c,status:E.value.status||200})),null};q&&B?await d(B):(s=M.getActiveScopeSpan(),await M.withPropagatedContext(e.headers,()=>M.trace(u.BaseServerSpan.handleRequest,{spanName:`${H} ${a}`,kind:i.SpanKind.SERVER,attributes:{"http.method":H,"http.target":e.url}},d),void 0,!q))}catch(t){if(t instanceof R.NoFallbackError||await O.onRequestError(e,t,{routerKind:"App Router",routePath:j,routeType:"route",revalidateReason:(0,l.getRevalidateReason)({isStaticGeneration:F,isOnDemandRevalidate:C})},!1,v),k)throw t;return await (0,T.sendResponse)(K,Y,new Response(null,{status:500})),null}}e.s(["handler",0,x,"patchFetch",0,function(){return(0,s.patchFetch)({workAsyncStorage:h,workUnitAsyncStorage:A})},"routeModule",0,O,"serverHooks",0,S,"workAsyncStorage",0,h,"workUnitAsyncStorage",0,A]),r()}catch(e){r(e)}},!1),70729,e=>{e.v(e=>Promise.resolve().then(()=>e(66680)))}];

//# sourceMappingURL=%5Broot-of-the-server%5D__1vx19k3._.js.map