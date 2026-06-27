import { mkdirSync } from "fs";
import { config } from "dotenv";
import {
  closeBrowserSession,
  createInstagramBrowserSession,
} from "../src/playwright/browser";
import { INSTAGRAM_BASE_URL } from "../src/playwright/constants";
import { getEnv } from "../src/config/env";
import { logger } from "../src/utils/logger";

config({ path: ".env.local", override: true });

async function main(): Promise<void> {
  const { INSTAGRAM_USERNAME, INSTAGRAM_PASSWORD } = getEnv();
  const session = await createInstagramBrowserSession();
  const page = session.page;

  try {
    await page.goto(`${INSTAGRAM_BASE_URL}/accounts/login/`, {
      waitUntil: "networkidle",
      timeout: 90000,
    });
    await page.waitForTimeout(2000);

    await page.locator('input[name="email"]').fill(INSTAGRAM_USERNAME!);
    await page.locator('input[name="pass"]').fill(INSTAGRAM_PASSWORD!);
    await page.locator('input[name="pass"]').press("Enter");
    await page.waitForTimeout(15000);

    mkdirSync("scripts/.research-output", { recursive: true });
    await page.screenshot({
      path: "scripts/.research-output/login-result.png",
      fullPage: true,
    });

    const state = await page.evaluate(() => ({
      url: location.href,
      title: document.title,
      bodyText: document.body.innerText.slice(0, 1500),
      cookies: document.cookie.includes("sessionid"),
    }));

    logger.info(JSON.stringify(state, null, 2));
  } finally {
    await closeBrowserSession(session);
  }
}

main().catch((error) => {
  logger.error("Debug login failed", error);
  process.exit(1);
});
