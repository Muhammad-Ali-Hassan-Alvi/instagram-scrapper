import { existsSync } from "fs";
import { mkdirSync } from "fs";
import { dirname } from "path";

import { chromium, type Browser, type BrowserContext, type Page } from "playwright";

import { getEnv } from "@/config/env";
import { logger } from "@/utils/logger";

import {
  INSTAGRAM_BASE_URL,
  INSTAGRAM_SESSION_PATH,
  USER_AGENT,
} from "./constants";

export interface BrowserSession {
  browser: Browser;
  context: BrowserContext;
  page: Page;
}

function ensureAuthDir(): void {
  const dir = dirname(INSTAGRAM_SESSION_PATH);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

export async function createInstagramBrowserSession(): Promise<BrowserSession> {
  const { SCRAPE_HEADLESS } = getEnv();
  ensureAuthDir();

  const browser = await chromium.launch({
    headless: SCRAPE_HEADLESS,
  });

  const context = await browser.newContext({
    userAgent: USER_AGENT,
    viewport: { width: 1280, height: 900 },
    ...(existsSync(INSTAGRAM_SESSION_PATH)
      ? { storageState: INSTAGRAM_SESSION_PATH }
      : {}),
  });

  const page = await context.newPage();
  return { browser, context, page };
}

export async function saveInstagramSession(context: BrowserContext): Promise<void> {
  ensureAuthDir();
  await context.storageState({ path: INSTAGRAM_SESSION_PATH });
  logger.info("Instagram session saved");
}

export async function closeBrowserSession(session: BrowserSession): Promise<void> {
  await session.context.close();
  await session.browser.close();
}

export async function warmInstagramPage(page: Page): Promise<void> {
  await page.goto(`${INSTAGRAM_BASE_URL}/`, {
    waitUntil: "domcontentloaded",
    timeout: 90000,
  });
  await page.waitForTimeout(1500);
}
