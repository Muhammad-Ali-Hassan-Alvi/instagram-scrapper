import { config } from "dotenv";

import {
  closeBrowserSession,
  createTikTokBrowserSession,
} from "../src/playwright/browser";
import { ensureTikTokLogin } from "../src/playwright/tiktok-auth";
import { logger } from "../src/utils/logger";

config({ path: ".env.local", override: true });
process.env.SCRAPE_HEADLESS = "false";

async function main(): Promise<void> {
  const session = await createTikTokBrowserSession();
  try {
    const ok = await ensureTikTokLogin(session.page, session.context);
    logger.info(ok ? "Login OK — session saved to .auth/tiktok-session.json" : "Login failed");
    process.exit(ok ? 0 : 1);
  } finally {
    await closeBrowserSession(session);
  }
}

main().catch((error) => {
  logger.error("TikTok login script failed", error);
  process.exit(1);
});
