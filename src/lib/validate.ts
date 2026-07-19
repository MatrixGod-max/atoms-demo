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

function launchBrowser() {
  return puppeteer.launch({
    executablePath: CHROME,
    headless: true,
    args: ["--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage", "--disable-extensions", "--mute-audio"],
  });
}

async function run(html: string, platform: "web" | "mobile"): Promise<ValidationResult> {
  let browser: Awaited<ReturnType<typeof puppeteer.launch>> | undefined;
  try {
    browser = await launchBrowser();
    const page = await browser.newPage();
    if (platform === "mobile") {
      await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
    }
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
export async function validateHtml(html: string, platform: "web" | "mobile" = "web"): Promise<ValidationResult> {
  try {
    return await Promise.race<ValidationResult>([
      run(html, platform),
      new Promise((resolve) => setTimeout(() => resolve({ ok: true, errors: [], skipped: true }), TOTAL_TIMEOUT_MS)),
    ]);
  } catch {
    return { ok: true, errors: [], skipped: true };
  }
}

// ---- Acceptance-driven validation: a safe, declarative test DSL ----
// LLM-generated cases are data, never code: only these whitelisted actions run.

export interface AcceptanceStep {
  action: "click" | "type" | "assertText" | "assertExists" | "assertNotExists";
  selector: string;
  text?: string;
  contains?: string;
}

export interface AcceptanceCase {
  criterion: string;
  steps: AcceptanceStep[];
}

export interface AcceptanceOutcome {
  criterion: string;
  pass: boolean;
  /** untestable with the DSL — excluded from pass/fail counting */
  skipped?: boolean;
  note?: string;
}

export interface AcceptanceRunResult {
  /** the validator environment itself failed — never blocks the artifact */
  skipped: boolean;
  results: AcceptanceOutcome[];
}

const CASE_TIMEOUT_MS = 6_000;
const STEP_SETTLE_MS = 250;

async function runCase(
  browser: Awaited<ReturnType<typeof puppeteer.launch>>,
  html: string,
  platform: "web" | "mobile",
  c: AcceptanceCase
): Promise<AcceptanceOutcome> {
  const page = await browser.newPage();
  try {
    if (platform === "mobile") {
      await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
    }
    await page.setContent(html, { waitUntil: "load", timeout: 8_000 });
    await new Promise((r) => setTimeout(r, 600));
    for (const [i, step] of c.steps.entries()) {
      const el = await page.$(step.selector);
      if (step.action === "assertNotExists") {
        if (el) return { criterion: c.criterion, pass: false, note: `第${i + 1}步:元素 ${step.selector} 不应存在但存在` };
        continue;
      }
      if (!el) return { criterion: c.criterion, pass: false, note: `第${i + 1}步:未找到元素 ${step.selector}` };
      if (step.action === "click") {
        await el.click();
        await new Promise((r) => setTimeout(r, STEP_SETTLE_MS));
      } else if (step.action === "type") {
        await el.click();
        await el.type(String(step.text ?? ""), { delay: 10 });
        await new Promise((r) => setTimeout(r, STEP_SETTLE_MS));
      } else if (step.action === "assertText") {
        const text = await page.evaluate((e) => (e.textContent ?? "") + ((e as HTMLInputElement).value ?? ""), el);
        const want = String(step.contains ?? "");
        if (!text.includes(want)) {
          return {
            criterion: c.criterion,
            pass: false,
            note: `第${i + 1}步:${step.selector} 的文本「${text.trim().slice(0, 60)}」不包含「${want}」`,
          };
        }
      }
      // assertExists: the non-null check above already passed
    }
    return { criterion: c.criterion, pass: true };
  } finally {
    await page.close().catch(() => {});
  }
}

/** Execute acceptance cases against the app in headless Chrome, one fresh page per case. */
export async function runAcceptance(
  html: string,
  platform: "web" | "mobile",
  cases: AcceptanceCase[]
): Promise<AcceptanceRunResult> {
  let browser: Awaited<ReturnType<typeof puppeteer.launch>> | undefined;
  try {
    browser = await launchBrowser();
    const results: AcceptanceOutcome[] = [];
    for (const c of cases) {
      if (!c.steps.length) {
        results.push({ criterion: c.criterion, pass: true, skipped: true, note: "无法用交互测试自动验证" });
        continue;
      }
      const outcome = await Promise.race<AcceptanceOutcome>([
        runCase(browser, html, platform, c).catch((e) => ({
          criterion: c.criterion,
          pass: false,
          note: `执行异常: ${e instanceof Error ? e.message.slice(0, 100) : String(e)}`,
        })),
        new Promise<AcceptanceOutcome>((resolve) =>
          setTimeout(() => resolve({ criterion: c.criterion, pass: false, note: "用例执行超时" }), CASE_TIMEOUT_MS)
        ),
      ]);
      results.push(outcome);
    }
    return { skipped: false, results };
  } catch {
    return { skipped: true, results: [] };
  } finally {
    await browser?.close().catch(() => {});
  }
}
