/**
 * Dev helper: captures dashboard screenshots with headless Chromium into docs/screenshots.
 * Needs the dev server running with DEV_LOGIN_BYPASS=true.
 *
 *   npx tsx scripts/screenshots.ts empty   # before any account has posted
 *   npx tsx scripts/screenshots.ts live    # while `npm run simulate` is running
 *
 * Set CHROMIUM_PATH to use a specific Chromium binary.
 */
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { chromium, type Page } from "@playwright/test";

const base = process.env.COMET_URL ?? "http://localhost:3000";
const phase = process.argv[2] ?? "live";
const out = join(import.meta.dirname, "..", "docs", "screenshots");
mkdirSync(out, { recursive: true });

async function login(page: Page) {
  await page.goto(`${base}/games/adopt_me`);
  await page.getByRole("button", { name: "Dev login" }).click();
  await page.getByText(/\d+ live/).waitFor();
  await page.getByText("Connected", { exact: true }).waitFor();
}

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
const page = await context.newPage();

if (phase === "empty") {
  await page.goto(`${base}/games/adopt_me`);
  await page.getByText("NO ACCOUNTS YET").waitFor();
  await page.waitForTimeout(800);
  await page.screenshot({ path: join(out, "logged-out.png") });

  await login(page);
  await page.waitForTimeout(800);
  await page.screenshot({ path: join(out, "empty-state.png") });
} else {
  await login(page);
  await page.locator("tbody tr").first().waitFor();
  const before = await page.locator("tbody tr").count();
  console.log(`adopt_me rows on load: ${before}`);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: join(out, "adopt-me-live.png") });

  await page.getByRole("link", { name: /Blox Fruits/ }).first().click();
  await page.getByRole("heading", { name: "Blox Fruits" }).waitFor();
  await page.locator("tbody tr").first().waitFor();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: join(out, "blox-fruits-live.png") });

  await page.getByRole("button", { name: "Connect Script" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Revoke" }).first().waitFor();
  await page.waitForTimeout(600);
  await page.screenshot({ path: join(out, "connect-script.png") });
  await page.keyboard.press("Escape");

  const mobile = await context.newPage();
  await mobile.setViewportSize({ width: 390, height: 844 });
  await mobile.goto(`${base}/games/blox_fruits`);
  await mobile.locator("tbody tr").first().waitFor();
  await mobile.waitForTimeout(800);
  await mobile.screenshot({ path: join(out, "mobile.png"), fullPage: true });
}

await browser.close();
console.log(`screenshots written to ${out}`);
