import type { BrowserContext, Page } from "playwright";

import { getEnv, hasTikTokCredentials } from "@/config/env";
import { logger } from "@/utils/logger";

import {
  hasStoredTikTokSession,
  saveTikTokSession,
} from "./browser";
import { TIKTOK_BASE_URL } from "./constants";
import { hasTikTokAuthCookies } from "./tiktok-session";
import { dismissTikTokOverlays } from "./tiktok-ui";

async function clickIfVisible(page: Page, selector: string): Promise<boolean> {
  const button = page.locator(selector).first();
  if (await button.isVisible({ timeout: 1500 }).catch(() => false)) {
    await button.click().catch(() => undefined);
    await page.waitForTimeout(800);
    return true;
  }
  return false;
}

async function dismissTikTokPrompts(page: Page): Promise<void> {
  await dismissTikTokOverlays(page);
}

async function isTikTokLoggedIn(page: Page): Promise<boolean> {
  const cookies = await page.context().cookies(TIKTOK_BASE_URL);
  return hasTikTokAuthCookies(cookies);
}

async function fillTikTokLoginForm(page: Page, username: string, password: string): Promise<void> {
  await dismissTikTokPrompts(page);

  // Selectors from TikTok TWV login markup embedded in copied profile HTML.
  const emailView = page.locator(".twv-web-email-view");
  const emailVisible = await emailView
    .waitFor({ state: "visible", timeout: 20000 })
    .then(() => true)
    .catch(() => false);

  if (emailVisible) {
    const emailInput = emailView
      .locator(".twv-components-mobile-normal-input__container__input")
      .first();
    await emailInput.waitFor({ state: "visible", timeout: 45000 });
    await emailInput.fill(username);

    await emailView
      .locator(
        ".email-view-wrapper__button .twv-component-button, .email-view-wrapper__button button, .twv-component-button",
      )
      .first()
      .click()
      .catch(() => undefined);
    await page.waitForTimeout(1200);

    const passwordView = page.locator(".twv-web-password-view");
    await passwordView.waitFor({ state: "visible", timeout: 30000 });

    const passwordInput = passwordView
      .locator('.twv-components-mobile-normal-input__container__input, input[type="password"]')
      .first();
    await passwordInput.waitFor({ state: "visible", timeout: 30000 });
    await passwordInput.fill(password);

    await passwordView
      .locator(
        ".password-view-wrapper__button .twv-component-button, .password-view-wrapper__button button, .twv-component-button",
      )
      .first()
      .click()
      .catch(async () => {
        await passwordInput.press("Enter");
      });
    return;
  }

  // Fallback if TikTok serves a non-TWV login form.
  const usernameInput = page
    .locator(
      'input[name="username"], input[placeholder*="Email" i], input[placeholder*="email" i], input[type="text"]',
    )
    .first();
  const passwordInput = page.locator('input[type="password"]').first();

  await usernameInput.waitFor({ state: "visible", timeout: 45000 });
  await usernameInput.fill(username);
  await passwordInput.fill(password);

  if (await clickIfVisible(page, 'button[type="submit"]')) return;
  if (await clickIfVisible(page, 'button:has-text("Log in")')) return;
  await passwordInput.press("Enter");
}

async function waitForTikTokLogin(page: Page, manualFallbackMs = 180000): Promise<boolean> {
  const deadline = Date.now() + manualFallbackMs;

  while (Date.now() < deadline) {
    if (await isTikTokLoggedIn(page)) {
      return true;
    }

    const url = page.url();
    if (!url.includes("/login")) {
      await dismissTikTokPrompts(page);
      if (await isTikTokLoggedIn(page)) {
        return true;
      }
    }

    await page.waitForTimeout(1000);
  }

  return isTikTokLoggedIn(page);
}

export async function ensureTikTokLogin(page: Page, context: BrowserContext): Promise<boolean> {
  await page.goto(TIKTOK_BASE_URL, {
    waitUntil: "domcontentloaded",
    timeout: 90000,
  });
  await page.waitForTimeout(2000);
  await dismissTikTokPrompts(page);

  if (await isTikTokLoggedIn(page)) {
    logger.info("TikTok session already active");
    await saveTikTokSession(context);
    return true;
  }

  if (hasStoredTikTokSession()) {
    logger.info("Stored TikTok session present — waiting for cookies to hydrate");
    await page.waitForTimeout(3000);
    await dismissTikTokPrompts(page);
    if (await isTikTokLoggedIn(page)) {
      logger.info("TikTok session restored from storage");
      return true;
    }
    logger.warn("Stored TikTok session expired — attempting fresh login");
  }

  if (!hasTikTokCredentials()) {
    logger.warn(
      "No TikTok credentials — log in manually in the browser window, or set TIKTOK_USERNAME/TIKTOK_PASSWORD in .env.local",
    );
    await page.goto(`${TIKTOK_BASE_URL}/login`, {
      waitUntil: "domcontentloaded",
      timeout: 90000,
    });
    logger.info("Waiting up to 3 minutes for manual TikTok login…");
    const manualOk = await waitForTikTokLogin(page);
    if (manualOk) {
      await saveTikTokSession(context);
    }
    return manualOk;
  }

  const { TIKTOK_USERNAME, TIKTOK_PASSWORD } = getEnv();
  logger.info("Logging into TikTok");

  try {
    await page.goto(`${TIKTOK_BASE_URL}/login/phone-or-email/email`, {
      waitUntil: "domcontentloaded",
      timeout: 90000,
    });
    await page.waitForTimeout(2000);
    await dismissTikTokPrompts(page);
    await fillTikTokLoginForm(page, TIKTOK_USERNAME!, TIKTOK_PASSWORD!);

    let loggedIn = await waitForTikTokLogin(page, 45000);
    if (!loggedIn) {
      logger.warn("Automated TikTok login did not complete — finish login in the browser window");
      loggedIn = await waitForTikTokLogin(page, 180000);
    }

    if (!loggedIn) {
      logger.warn("TikTok login did not establish session");
      return false;
    }

    await dismissTikTokPrompts(page);
    await saveTikTokSession(context);
    logger.info("TikTok login successful");
    return true;
  } catch (error) {
    logger.warn(
      "TikTok login failed",
      error instanceof Error ? error.message : error,
    );
    return false;
  }
}
