// Generate redeem codes for the credits system. Usage:
//   node scripts/gen-codes.mjs        # 5 codes per denomination (10 / 50 / 100)
//   node scripts/gen-codes.mjs 3      # 3 codes per denomination
import { DatabaseSync } from "node:sqlite";
import { randomBytes } from "node:crypto";
import { mkdirSync } from "node:fs";
import path from "node:path";

const perDenomination = Math.max(1, Number(process.argv[2]) || 5);
const DENOMINATIONS = [10, 50, 100];

const ROOT = new URL("..", import.meta.url).pathname;
const DATA_DIR = process.env.DATA_DIR || path.join(ROOT, "data");
mkdirSync(DATA_DIR, { recursive: true });
const db = new DatabaseSync(path.join(DATA_DIR, "quark.db"));
db.exec("PRAGMA busy_timeout = 5000");
// The app owns the schema; create the table here too so the script works on a fresh volume.
db.exec(`CREATE TABLE IF NOT EXISTS redeem_codes (
  code TEXT PRIMARY KEY, amount INTEGER NOT NULL,
  used_by TEXT, used_at INTEGER, created_at INTEGER NOT NULL
)`);

const chunk = () => randomBytes(2).toString("hex").toUpperCase();
const insert = db.prepare("INSERT INTO redeem_codes (code, amount, created_at) VALUES (?, ?, ?)");

for (const amount of DENOMINATIONS) {
  for (let i = 0; i < perDenomination; i++) {
    const code = `FUSION-${chunk()}-${chunk()}`;
    insert.run(code, amount, Date.now());
    console.log(`${code}  ${amount} 积分`);
  }
}
console.log(`done: ${DENOMINATIONS.length * perDenomination} codes`);
