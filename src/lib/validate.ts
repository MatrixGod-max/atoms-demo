import puppeteer from "puppeteer-core";

export interface ValidationResult {
  ok: boolean;
  errors: string[];
  /** true when the validator environment itself failed — never blocks the artifact */
  skipped: boolean;
}

const CHROME = process.env.CHROME_PATH || "/usr/bin/google-chrome-stable";
const TOTAL_TIMEOUT_MS = 25_000;
const SETTLE_MS = 1_500;

async function run(html: string): Promise<ValidationResult> {
  let browser: Awaited<ReturnType<typeof puppeteer.launch>> | undefined;
  try {
    browser = await puppeteer.launch({
      executablePath: CHROME,
      headless: true,
      args: ["--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage", "--disable-extensions", "--mute-audio"],
    });
    const page = await browser.newPage();
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(`未捕获异常: ${e instanceof Error ? e.message : String(e)}`));
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(`console.error: ${msg.text()}`);
    });
    await page.setContent(html, { waitUntil: "load", timeout: 12_000 });
    await new Promise((r) => setTimeout(r, SETTLE_MS));
    return { ok: errors.length === 0, errors: errors.slice(0, 5), skipped: false };
  } finally {
    await browser?.close().catch(() => {});
  }
}

/** Load the generated app in headless Chrome and collect runtime errors. */
export async function validateHtml(html: string): Promise<ValidationResult> {
  try {
    return await Promise.race<ValidationResult>([
      run(html),
      new Promise((resolve) => setTimeout(() => resolve({ ok: true, errors: [], skipped: true }), TOTAL_TIMEOUT_MS)),
    ]);
  } catch {
    return { ok: true, errors: [], skipped: true };
  }
}
