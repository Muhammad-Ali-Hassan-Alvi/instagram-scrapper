import { existsSync, readFileSync } from "fs";
import { mkdirSync } from "fs";
import { dirname } from "path";

import { chromium, type Browser, type BrowserContext, type Page } from "playwright";

import { getEnv } from "@/config/env";
import { logger } from "@/utils/logger";

import {
  INSTAGRAM_BASE_URL,
  INSTAGRAM_SESSION_PATH,
  TIKTOK_BASE_URL,
  TIKTOK_SESSION_PATH,
  USER_AGENT,
} from "./constants";
import { hasTikTokAuthCookies } from "./tiktok-session";

const TIKTOK_SESSION_EXTRAS_PATH = ".auth/tiktok-session-extras.json";

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

function ensureTikTokAuthDir(): void {
  const dir = dirname(TIKTOK_SESSION_PATH);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

export async function createInstagramBrowserSession(): Promise<BrowserSession> {
  const { SCRAPE_HEADLESS } = getEnv();
  ensureAuthDir();

  const browser = await chromium.launch({
    headless: SCRAPE_HEADLESS,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
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

export function hasStoredInstagramSession(): boolean {
  if (!existsSync(INSTAGRAM_SESSION_PATH)) return false;

  try {
    const raw = readFileSync(INSTAGRAM_SESSION_PATH, "utf8");
    const state = JSON.parse(raw) as { cookies?: Array<{ name: string; value: string }> };
    return Boolean(
      state.cookies?.some((cookie) => cookie.name === "sessionid" && cookie.value.length > 0),
    );
  } catch {
    return false;
  }
}

function readTikTokSessionExtras(): Record<string, string> | null {
  if (!existsSync(TIKTOK_SESSION_EXTRAS_PATH)) return null;

  try {
    const raw = readFileSync(TIKTOK_SESSION_EXTRAS_PATH, "utf8");
    const parsed = JSON.parse(raw) as { sessionStorage?: Record<string, string> };
    return parsed.sessionStorage ?? null;
  } catch {
    return null;
  }
}

export async function createTikTokBrowserSession(): Promise<BrowserSession> {
  const { SCRAPE_HEADLESS } = getEnv();
  ensureTikTokAuthDir();

  const browser = await chromium.launch({
    headless: SCRAPE_HEADLESS,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
  });

  const context = await browser.newContext({
    userAgent: USER_AGENT,
    viewport: { width: 1280, height: 900 },
    ...(existsSync(TIKTOK_SESSION_PATH) ? { storageState: TIKTOK_SESSION_PATH } : {}),
  });

  const sessionStorageItems = readTikTokSessionExtras();
  if (sessionStorageItems) {
    await context.addInitScript((items) => {
      for (const [key, value] of Object.entries(items)) {
        window.sessionStorage.setItem(key, value);
      }
    }, sessionStorageItems);
  }

  const page = await context.newPage();
  return { browser, context, page };
}

export async function saveTikTokSession(context: BrowserContext): Promise<void> {
  ensureTikTokAuthDir();
  await context.storageState({ path: TIKTOK_SESSION_PATH });
  logger.info("TikTok session saved");
}

export async function warmTikTokPage(page: Page): Promise<void> {
  await page.goto(`${TIKTOK_BASE_URL}/`, {
    waitUntil: "domcontentloaded",
    timeout: 90000,
  });
  await page.waitForTimeout(1500);
}

export function hasStoredTikTokSession(): boolean {
  if (!existsSync(TIKTOK_SESSION_PATH)) return false;

  try {
    const raw = readFileSync(TIKTOK_SESSION_PATH, "utf8");
    const state = JSON.parse(raw) as { cookies?: Array<{ name: string; value: string }> };
    return hasTikTokAuthCookies(state.cookies);
  } catch {
    return false;
  }
}
