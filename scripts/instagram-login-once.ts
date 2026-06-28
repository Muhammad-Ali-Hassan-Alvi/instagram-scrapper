import { config } from "dotenv";

import {
  closeBrowserSession,
  createInstagramBrowserSession,
} from "../src/playwright/browser";
import { ensureInstagramLogin } from "../src/playwright/instagram-auth";
import { logger } from "../src/utils/logger";

config({ path: ".env.local", override: true });
process.env.SCRAPE_HEADLESS = "false";

async function main(): Promise<void> {
  const session = await createInstagramBrowserSession();
  try {
    const ok = await ensureInstagramLogin(session.page, session.context);
    logger.info(ok ? "Login OK — session saved to .auth/" : "Login failed");
    process.exit(ok ? 0 : 1);
  } finally {
    await closeBrowserSession(session);
  }
}

main().catch((error) => {
  logger.error("Login script failed", error);
  process.exit(1);
});
