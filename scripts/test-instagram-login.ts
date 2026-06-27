import { config } from "dotenv";
import {
  closeBrowserSession,
  createInstagramBrowserSession,
  warmInstagramPage,
} from "../src/playwright/browser";
import { ensureInstagramLogin } from "../src/playwright/instagram-auth";
import { logger } from "../src/utils/logger";

config({ path: ".env.local", override: true });

async function main(): Promise<void> {
  const session = await createInstagramBrowserSession();
  try {
    await warmInstagramPage(session.page);
    const loggedIn = await ensureInstagramLogin(session.page, session.context);
    logger.info(loggedIn ? "Login OK" : "Login failed");
  } finally {
    await closeBrowserSession(session);
  }
}

main().catch((error) => {
  logger.error("Login test failed", error);
  process.exit(1);
});
