import { chromium } from "playwright";

import { INSTAGRAM_SESSION_PATH } from "../src/playwright/constants";

async function main(): Promise<void> {
  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  const context = await browser.newContext({ storageState: INSTAGRAM_SESSION_PATH });
  const page = await context.newPage();
  await page.goto("https://www.instagram.com/", {
    waitUntil: "domcontentloaded",
    timeout: 90000,
  });
  await page.waitForTimeout(3000);
  const cookies = await context.cookies();
  const session = cookies.find((c) => c.name === "sessionid");
  console.log("sessionid:", session ? `yes (${session.value.length} chars)` : "no");
  console.log("url:", page.url());
  await browser.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
