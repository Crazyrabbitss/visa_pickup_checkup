import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const artifactDir = path.join(root, "artifacts");
const localConfigPath = path.join(root, "config.local.json");
const exampleConfigPath = path.join(root, "config.example.json");

async function readConfig() {
  const configPath = await exists(localConfigPath) ? localConfigPath : exampleConfigPath;
  const raw = await fs.readFile(configPath, "utf8");
  const config = JSON.parse(raw);

  return {
    url: config.url ?? "https://schedule.gtspremium.com/",
    headless: process.env.HEADLESS ? process.env.HEADLESS !== "false" : config.headless !== false,
    timeoutMs: Number(config.timeoutMs ?? 45000),
    uidOrHal: process.env.PASSPORT_PICKUP_UID ?? config.uidOrHal ?? "",
    expectedText: Array.isArray(config.expectedText) ? config.expectedText : [],
    unavailableText: Array.isArray(config.unavailableText) ? config.unavailableText : [],
    availableText: Array.isArray(config.availableText) ? config.availableText : []
  };
}

async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function findMatches(text, needles) {
  const lower = text.toLowerCase();
  return needles.filter((needle) => lower.includes(String(needle).toLowerCase()));
}

async function clickCheckButton(page) {
  const buttonName = new RegExp("\\u67e5\\u8be2\\u53ef\\u7528\\u65f6\\u6bb5|check|available", "i");
  const namedButton = page.getByRole("button", { name: buttonName });

  if (await namedButton.count()) {
    await namedButton.first().click({ timeout: 5000 });
    return;
  }

  const buttons = page.locator("button, input[type='submit'], input[type='button']");
  const count = await buttons.count();

  if (count === 0) {
    throw new Error("No submit/check button found after entering UID.");
  }

  await buttons.nth(count - 1).click({ timeout: 5000 });
}

async function main() {
  const config = await readConfig();
  await fs.mkdir(artifactDir, { recursive: true });

  const browser = await chromium.launch({ headless: config.headless });
  const page = await browser.newPage({ viewport: { width: 1365, height: 900 } });

  const state = {
    checkedAt: new Date().toISOString(),
    url: config.url,
    status: "unknown",
    title: null,
    finalUrl: null,
    expectedMatches: [],
    unavailableMatches: [],
    availableMatches: [],
    error: null,
    screenshot: "artifacts/latest.png"
  };

  try {
    await page.goto(config.url, { waitUntil: "domcontentloaded", timeout: config.timeoutMs });
    await page.waitForLoadState("networkidle", { timeout: config.timeoutMs }).catch(() => {});
    await page.locator("body").waitFor({ state: "visible", timeout: config.timeoutMs });

    state.title = await page.title();
    state.finalUrl = page.url();

    let bodyText = await page.locator("body").innerText({ timeout: config.timeoutMs }).catch(() => "");
    state.expectedMatches = findMatches(bodyText, config.expectedText);

    if (!config.uidOrHal) {
      state.status = state.expectedMatches.length > 0 ? "needs-uid" : "loaded-without-known-text";
    } else {
      const uidInput = page.locator("input").first();
      await uidInput.fill(String(config.uidOrHal));

      const termsCheckbox = page.locator("input[type='checkbox']").first();
      await termsCheckbox.check({ force: true });

      await clickCheckButton(page);
      await page.waitForLoadState("networkidle", { timeout: config.timeoutMs }).catch(() => {});
      await page.waitForTimeout(3000);

      bodyText = await page.locator("body").innerText({ timeout: config.timeoutMs }).catch(() => "");
      state.unavailableMatches = findMatches(bodyText, config.unavailableText);
      state.availableMatches = findMatches(bodyText, config.availableText);

      if (state.unavailableMatches.length > 0) {
        state.status = "unavailable";
      } else if (state.availableMatches.length > 0) {
        state.status = "appointment-available";
      } else {
        state.status = "checked-no-known-result";
      }
    }

    await page.screenshot({ path: path.join(artifactDir, "latest.png"), fullPage: true });
  } catch (error) {
    state.status = "error";
    state.error = error instanceof Error ? error.message : String(error);
    await page.screenshot({ path: path.join(artifactDir, "latest.png"), fullPage: true }).catch(() => {});
  } finally {
    await browser.close();
  }

  await fs.writeFile(path.join(artifactDir, "latest-state.json"), `${JSON.stringify(state, null, 2)}\n`);
  console.log(JSON.stringify(state, null, 2));

  if (state.status === "error") {
    process.exitCode = 1;
  }
}

main();
