import { DatabaseSync } from "node:sqlite";
import { randomBytes } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), "data");

function createDb(): DatabaseSync {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const db = new DatabaseSync(path.join(DATA_DIR, "quark.db"));
  // Next.js build collects page data with several workers importing this module
  // concurrently; without a busy timeout the parallel WAL/DDL init throws
  // SQLITE_BUSY ("database is locked").
  db.exec("PRAGMA busy_timeout = 5000");
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS users (
      id            TEXT PRIMARY KEY,
      email         TEXT NOT NULL UNIQUE,
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

    CREATE TABLE IF NOT EXISTS app_kv (
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      k          TEXT NOT NULL,
      v          TEXT NOT NULL,
      updated_at INTEGER NOT NULL,
      PRIMARY KEY (project_id, k)
    );

    CREATE INDEX IF NOT EXISTS idx_jobs_project ON jobs(project_id, status);
    CREATE INDEX IF NOT EXISTS idx_projects_gallery ON projects(published_version_id, updated_at);
    CREATE INDEX IF NOT EXISTS idx_messages_project ON messages(project_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_versions_project ON app_versions(project_id, num);
    CREATE INDEX IF NOT EXISTS idx_projects_user ON projects(user_id, updated_at);
  `);
  ensureColumn(db, "projects", "in_gallery", "in_gallery INTEGER NOT NULL DEFAULT 1");
  ensureColumn(db, "projects", "platform", "platform TEXT NOT NULL DEFAULT 'web' CHECK (platform IN ('web','mobile'))");
  ensureColumn(db, "users", "is_demo", "is_demo INTEGER NOT NULL DEFAULT 0");
  backfillArtifacts(db);
  return db;
}

/** Idempotent: projects published before the artifact concept existed get artifact #1. */
function backfillArtifacts(db: DatabaseSync) {
  const rows = db
    .prepare(
      `SELECT p.id AS project_id, p.published_version_id AS version_id, v.prompt
       FROM projects p JOIN app_versions v ON v.id = p.published_version_id
       WHERE p.published_version_id IS NOT NULL
         AND NOT EXISTS (SELECT 1 FROM artifacts a WHERE a.project_id = p.id)`
    )
    .all() as { project_id: string; version_id: string; prompt: string }[];
  const insert = db.prepare(
    "INSERT INTO artifacts (id, project_id, version_id, seq, notes, created_at) VALUES (?, ?, ?, 1, ?, ?)"
  );
  for (const r of rows) {
    insert.run(`a_${randomBytes(9).toString("base64url")}`, r.project_id, r.version_id, r.prompt, Date.now());
  }
}

/** Additive migration: CREATE TABLE IF NOT EXISTS won't extend existing tables. */
function ensureColumn(db: DatabaseSync, table: string, column: string, ddl: string) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  if (!cols.some((c) => c.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${ddl}`);
  }
}

// Survive Next.js dev HMR: keep a single connection on globalThis.
const g = globalThis as unknown as { __quarkDb?: DatabaseSync };
export const db: DatabaseSync = g.__quarkDb ?? (g.__quarkDb = createDb());

export function now(): number {
  return Date.now();
}
