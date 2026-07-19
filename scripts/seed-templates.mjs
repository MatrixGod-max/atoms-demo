// Idempotent template seeding: upsert into SQLite and mirror each template to a
// dedicated S3 key in the resource bucket. Usage:
//   node scripts/seed-templates.mjs            # DB + S3
//   node scripts/seed-templates.mjs --no-s3    # DB only (CI / no credentials)
import { DatabaseSync } from "node:sqlite";
import { mkdirSync, readFileSync } from "node:fs";
import path from "node:path";

const NO_S3 = process.argv.includes("--no-s3");
const ROOT = new URL("..", import.meta.url).pathname;
const DATA_DIR = process.env.DATA_DIR || path.join(ROOT, "data");
mkdirSync(DATA_DIR, { recursive: true });
const db = new DatabaseSync(path.join(DATA_DIR, "quark.db"));
db.exec("PRAGMA busy_timeout = 5000");
// The app owns the schema; create the table here too so seeding works on a fresh volume.
db.exec(`CREATE TABLE IF NOT EXISTS templates (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, category TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('web','mobile')),
  description TEXT NOT NULL, html TEXT NOT NULL,
  s3_bucket TEXT, s3_key TEXT, created_at INTEGER NOT NULL
)`);

const manifest = JSON.parse(readFileSync(path.join(ROOT, "templates/manifest.json"), "utf8"));

let upload = null;
if (!NO_S3) {
  const mod = await import("@aws-sdk/client-s3");
  const region = process.env.AWS_REGION || "us-west-1";
  const bucket = process.env.QUARK_RESOURCE_BUCKET || "quark-res-981861585685";
  const s3 = new mod.S3Client({ region });
  try {
    await s3.send(new mod.HeadBucketCommand({ Bucket: bucket }));
  } catch {
    await s3.send(
      region === "us-east-1"
        ? new mod.CreateBucketCommand({ Bucket: bucket })
        : new mod.CreateBucketCommand({ Bucket: bucket, CreateBucketConfiguration: { LocationConstraint: region } })
    );
    console.log("created resource bucket", bucket);
  }
  upload = async (id, html) => {
    const key = `templates/${id}.html`;
    await s3.send(
      new mod.PutObjectCommand({ Bucket: bucket, Key: key, Body: html, ContentType: "text/html; charset=utf-8" })
    );
    return { bucket, key };
  };
}

const upsert = db.prepare(`
  INSERT INTO templates (id, name, category, platform, description, html, s3_bucket, s3_key, created_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(id) DO UPDATE SET name=excluded.name, category=excluded.category, platform=excluded.platform,
    description=excluded.description, html=excluded.html, s3_bucket=excluded.s3_bucket, s3_key=excluded.s3_key
`);

for (const t of manifest) {
  const html = readFileSync(path.join(ROOT, "templates", t.file), "utf8");
  let s3ref = { bucket: null, key: null };
  if (upload) s3ref = await upload(t.id, html);
  upsert.run(t.id, t.name, t.category, t.platform, t.description, html, s3ref.bucket, s3ref.key, Date.now());
  console.log(`seeded ${t.id} (${t.name})${s3ref.key ? ` -> s3://${s3ref.bucket}/${s3ref.key}` : ""}`);
}
console.log("done:", manifest.length, "templates");
