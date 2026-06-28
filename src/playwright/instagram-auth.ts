import type { BrowserContext, Page } from "playwright";

import { getEnv, hasInstagramCredentials } from "@/config/env";
import { logger } from "@/utils/logger";

import { saveInstagramSession, hasStoredInstagramSession } from "./browser";
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

async function submitEmailCode(page: Page, code: string): Promise<boolean> {
  await dismissPostLoginPrompts(page);

  const codeInput = page
    .locator(
      'input[name="code"], input[autocomplete="one-time-code"], input[inputmode="numeric"], input[aria-label="Code"], input[placeholder="Code"]',
    )
    .first();

  const codeByLabel = page.getByLabel("Code", { exact: false });

  const target = (await codeInput.isVisible({ timeout: 3000 }).catch(() => false))
    ? codeInput
    : codeByLabel;

  if (!(await target.isVisible({ timeout: 10000 }).catch(() => false))) {
    logger.warn("Email code input not found on page");
    return false;
  }

  await target.fill(code);
  await page.waitForTimeout(500);
  await clickIfVisible(page, 'button:has-text("Continue")');
  await clickIfVisible(page, 'div[role="button"]:has-text("Continue")');
  await page.waitForTimeout(3000);
  return isLoggedIn(page);
}

async function waitForLoginSession(page: Page, emailCode?: string): Promise<boolean> {
  const deadline = Date.now() + 120000;
  let codeAttempted = false;

  while (Date.now() < deadline) {
    if (await isLoggedIn(page)) {
      return true;
    }

    if (emailCode && !codeAttempted && (await isEmailCodeChallenge(page))) {
      logger.info("Submitting Instagram email verification code");
      codeAttempted = true;
      if (await submitEmailCode(page, emailCode)) {
        return true;
      }
    }

    const url = page.url();
    if (url.includes("/accounts/onetap") || url.includes("/challenge")) {
      await dismissPostLoginPrompts(page);
    }

    if (!url.includes("/accounts/login") && !url.includes("/auth_platform/")) {
      await dismissPostLoginPrompts(page);
      if (await isLoggedIn(page)) {
        return true;
      }
    }

    await page.waitForTimeout(1000);
  }

  return isLoggedIn(page);
}

async function isEmailCodeChallenge(page: Page): Promise<boolean> {
  const url = page.url();
  if (url.includes("/auth_platform/codeentry") || url.includes("/challenge")) {
    return true;
  }

  const bodyText = await page.locator("body").innerText().catch(() => "");
  return bodyText.includes("Check your email") || bodyText.includes("Enter the code");
}

async function fillLoginForm(page: Page, username: string, password: string): Promise<void> {
  await dismissPostLoginPrompts(page);

  const usernameInput = page
    .locator(
      'input[name="email"], input[name="username"], input[aria-label="Phone number, username, or email"], input[placeholder*="username" i], input[placeholder*="Mobile number" i], input[autocomplete="username webauthn"], input[autocomplete="username"]',
    )
    .first();

  const visible = await usernameInput.isVisible({ timeout: 8000 }).catch(() => false);
  if (!visible) {
    const loginLink = page.locator('a[href*="/accounts/login"]').first();
    if (await loginLink.isVisible({ timeout: 3000 }).catch(() => false)) {
      await loginLink.click();
      await page.waitForTimeout(2000);
      await dismissPostLoginPrompts(page);
    }
  }

  const passwordInput = page
    .locator(
      'input[name="pass"], input[name="password"], input[aria-label="Password"], input[type="password"]',
    )
    .first();

  await usernameInput.waitFor({ state: "visible", timeout: 45000 });
  await usernameInput.fill(username);
  await passwordInput.fill(password);

  const loginButton = page.getByRole("button", { name: "Log in", exact: true });
  if (await loginButton.isVisible({ timeout: 2000 }).catch(() => false)) {
    await loginButton.click();
    return;
  }

  await passwordInput.press("Enter");
}

async function waitForManualInstagramLogin(page: Page, timeoutMs = 180000): Promise<boolean> {
  logger.info("Complete Instagram login in the browser window (up to 3 minutes)…");
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    await dismissPostLoginPrompts(page);
    if (await isLoggedIn(page)) {
      return true;
    }
    await page.waitForTimeout(1000);
  }

  return isLoggedIn(page);
}

export async function dismissInstagramCheckpoint(page: Page): Promise<void> {
  const url = page.url();
  if (!url.includes("/challenge") && !url.includes("scraping_warning")) {
    await page.goto(`${INSTAGRAM_BASE_URL}/`, {
      waitUntil: "domcontentloaded",
      timeout: 90000,
    });
    await page.waitForTimeout(2000);
  }

  if (page.url().includes("/challenge") || page.url().includes("scraping_warning")) {
    logger.info("Instagram checkpoint detected — attempting to dismiss");
    await dismissPostLoginPrompts(page);
    await clickIfVisible(page, 'button:has-text("Dismiss")');
    await clickIfVisible(page, 'div[role="button"]:has-text("Dismiss")');
    await page.waitForTimeout(3000);
  }
}

export async function ensureInstagramLogin(page: Page, context: BrowserContext): Promise<boolean> {
  await page.goto(`${INSTAGRAM_BASE_URL}/`, {
    waitUntil: "domcontentloaded",
    timeout: 90000,
  });
  await page.waitForTimeout(2000);
  await dismissPostLoginPrompts(page);

  if (await isLoggedIn(page)) {
    logger.info("Instagram session already active");
    await saveInstagramSession(context);
    return true;
  }

  if (hasStoredInstagramSession()) {
    logger.info("Stored session present — waiting for cookies to hydrate");
    await page.waitForTimeout(3000);
    await dismissPostLoginPrompts(page);
    if (await isLoggedIn(page)) {
      logger.info("Instagram session restored from storage");
      return true;
    }

    logger.warn(
      "Stored session expired — will attempt fresh login unless INSTAGRAM_SESSION_ONLY=true",
    );
    if (getEnv().INSTAGRAM_SESSION_ONLY) {
      logger.warn(
        "INSTAGRAM_SESSION_ONLY is set — run npm run sync:session-to-ec2 from your laptop to refresh the session",
      );
      return false;
    }
  }

  if (!hasInstagramCredentials()) {
    logger.warn("No Instagram credentials — running in public-only mode (first ~12 posts per account)");
    return false;
  }

  const { INSTAGRAM_USERNAME, INSTAGRAM_PASSWORD, INSTAGRAM_EMAIL_CODE } = getEnv();
  logger.info("Logging into Instagram");

  try {
    await page.goto(`${INSTAGRAM_BASE_URL}/accounts/login/`, {
      waitUntil: "domcontentloaded",
      timeout: 90000,
    });
    await page.waitForTimeout(2000);
    await dismissPostLoginPrompts(page);

    try {
      await fillLoginForm(page, INSTAGRAM_USERNAME!, INSTAGRAM_PASSWORD!);
    } catch (formError) {
      logger.warn(
        "Instagram login form not found — finish login manually in the browser",
        formError instanceof Error ? formError.message : formError,
      );
      if (await waitForManualInstagramLogin(page)) {
        await dismissPostLoginPrompts(page);
        await saveInstagramSession(context);
        logger.info("Instagram manual login successful");
        return true;
      }
      return false;
    }

    let loggedIn = await waitForLoginSession(page, INSTAGRAM_EMAIL_CODE);
    if (!loggedIn) {
      loggedIn = await waitForManualInstagramLogin(page);
    }
    if (!loggedIn) {
      if (await isEmailCodeChallenge(page)) {
        logger.warn(
          "Instagram requires email verification — sync .auth/instagram-session.json from your laptop (npm run sync:session-to-ec2) or set INSTAGRAM_EMAIL_CODE in .env.local",
        );
        return false;
      }
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
