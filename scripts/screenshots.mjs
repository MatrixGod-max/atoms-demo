// Regenerate README screenshots. Usage:
//   BASE_URL=https://quark.lexarcai.com DEMO_EMAIL=demo@quark.dev DEMO_PASSWORD=... node scripts/screenshots.mjs
import puppeteer from "puppeteer-core";
import { mkdirSync } from "node:fs";

const BASE = process.env.BASE_URL || "https://quark.lexarcai.com";
const EMAIL = process.env.DEMO_EMAIL || "demo@quark.dev";
const PASSWORD = process.env.DEMO_PASSWORD || "quark123";
const CHROME = process.env.CHROME_PATH || "/usr/bin/google-chrome-stable";

mkdirSync("docs", { recursive: true });

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ["--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage"],
});

async function shot(page, path) {
  await new Promise((r) => setTimeout(r, 1200));
  await page.screenshot({ path });
  console.log("saved", path);
}

const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });

await page.goto(`${BASE}/`, { waitUntil: "networkidle2", timeout: 60000 });
await shot(page, "docs/landing.png");

await page.goto(`${BASE}/explore`, { waitUntil: "networkidle2", timeout: 60000 });
await shot(page, "docs/explore.png");

await page.goto(`${BASE}/login`, { waitUntil: "networkidle2", timeout: 60000 });
await page.type('input[type="email"]', EMAIL);
await page.type('input[type="password"]', PASSWORD);
await Promise.all([page.waitForNavigation({ waitUntil: "networkidle2" }), page.click('button[type="submit"]')]);

// open the first project on the dashboard
await page.waitForSelector('a[href^="/project/"]', { timeout: 30000 });
const href = await page.$eval('a[href^="/project/"]', (a) => a.getAttribute("href"));
await page.goto(`${BASE}${href}`, { waitUntil: "networkidle2", timeout: 60000 });
await shot(page, "docs/builder.png");

await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
await page.reload({ waitUntil: "networkidle2" });
await shot(page, "docs/builder-mobile.png");

await browser.close();
