import type { BrowserContext, Page } from "playwright";

import { getEnv, hasInstagramCredentials } from "@/config/env";
import { logger } from "@/utils/logger";

import { saveInstagramSession } from "./browser";
import { INSTAGRAM_BASE_URL } from "./constants";

async function clickIfVisible(page: Page, selector: string): Promise<boolean> {
  const button = page.locator(selector).first();
  if (await button.isVisible({ timeout: 1500 }).catch(() => false)) {
    await button.click().catch(() => undefined);
    await page.waitForTimeout(800);
    return true;
  }
  return false;
}

async function dismissPostLoginPrompts(page: Page): Promise<void> {
  const selectors = [
    'button:has-text("Not now")',
    'button:has-text("Not Now")',
    'div[role="button"]:has-text("Not now")',
    'button:has-text("Save info")',
    'div[role="button"]:has-text("Save info")',
    'button:has-text("Allow all cookies")',
    'button:has-text("Accept All")',
    'button:has-text("Decline optional cookies")',
  ];

  for (let attempt = 0; attempt < 5; attempt++) {
    let clicked = false;
    for (const selector of selectors) {
      if (await clickIfVisible(page, selector)) {
        clicked = true;
      }
    }
    if (!clicked) break;
    await page.waitForTimeout(500);
  }
}

async function isLoggedIn(page: Page): Promise<boolean> {
  const cookies = await page.context().cookies();
  return cookies.some((cookie) => cookie.name === "sessionid" && cookie.value.length > 0);
}

async function waitForLoginSession(page: Page): Promise<boolean> {
  const deadline = Date.now() + 90000;

  while (Date.now() < deadline) {
    if (await isLoggedIn(page)) {
      return true;
    }

    const url = page.url();
    if (url.includes("/accounts/onetap") || url.includes("/challenge")) {
      await dismissPostLoginPrompts(page);
    }

    if (!url.includes("/accounts/login")) {
      await dismissPostLoginPrompts(page);
      if (await isLoggedIn(page)) {
        return true;
      }
    }

    await page.waitForTimeout(1000);
  }

  return isLoggedIn(page);
}

async function fillLoginForm(page: Page, username: string, password: string): Promise<void> {
  const usernameInput = page
    .locator(
      'input[name="email"], input[name="username"], input[autocomplete="username webauthn"], input[autocomplete="username"]',
    )
    .first();

  const passwordInput = page
    .locator('input[name="pass"], input[name="password"], input[type="password"]')
    .first();

  await usernameInput.waitFor({ state: "visible", timeout: 30000 });
  await usernameInput.fill(username);
  await passwordInput.fill(password);

  const loginButton = page.getByRole("button", { name: "Log in", exact: true });
  if (await loginButton.isVisible({ timeout: 2000 }).catch(() => false)) {
    await loginButton.click();
    return;
  }

  await passwordInput.press("Enter");
}

export async function ensureInstagramLogin(page: Page, context: BrowserContext): Promise<boolean> {
  await page.goto(`${INSTAGRAM_BASE_URL}/`, {
    waitUntil: "domcontentloaded",
    timeout: 90000,
  });
  await page.waitForTimeout(1500);
  await dismissPostLoginPrompts(page);

  if (await isLoggedIn(page)) {
    logger.info("Instagram session already active");
    return true;
  }

  if (!hasInstagramCredentials()) {
    logger.warn("No Instagram credentials — running in public-only mode (first ~12 posts per account)");
    return false;
  }

  const { INSTAGRAM_USERNAME, INSTAGRAM_PASSWORD } = getEnv();
  logger.info("Logging into Instagram");

  try {
    await page.goto(`${INSTAGRAM_BASE_URL}/accounts/login/`, {
      waitUntil: "domcontentloaded",
      timeout: 90000,
    });
    await page.waitForTimeout(2000);
    await dismissPostLoginPrompts(page);
    await fillLoginForm(page, INSTAGRAM_USERNAME!, INSTAGRAM_PASSWORD!);

    const loggedIn = await waitForLoginSession(page);
    if (!loggedIn) {
      const errorText = await page
        .locator("body")
        .innerText()
        .catch(() => "");
      if (errorText.includes("incorrect")) {
        logger.warn("Instagram rejected login credentials");
      } else {
        logger.warn("Instagram login did not establish session");
      }
      return false;
    }

    await dismissPostLoginPrompts(page);

    if (page.url().includes("/accounts/onetap")) {
      await page.goto(`${INSTAGRAM_BASE_URL}/`, { waitUntil: "domcontentloaded" });
      await dismissPostLoginPrompts(page);
    }

    await saveInstagramSession(context);
    logger.info("Instagram login successful");
    return true;
  } catch (error) {
    logger.warn(
      "Instagram login failed — continuing in public-only mode",
      error instanceof Error ? error.message : error,
    );
    return false;
  }
}
