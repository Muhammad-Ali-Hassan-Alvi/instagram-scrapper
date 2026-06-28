import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

import { config } from "dotenv";

import { DEFAULT_TARGET_ACCOUNTS } from "@/config/accounts";
import {
  closeBrowserSession,
  createTikTokBrowserSession,
} from "@/playwright/browser";
import { ensureTikTokLogin } from "@/playwright/tiktok-auth";
import { TikTokClient } from "@/scrapers/tiktok/client";
import { logger } from "@/utils/logger";

config({ path: ".env.local", override: true });
process.env.SCRAPE_HEADLESS = "false";

const OUTPUT_PATH = resolve("data/ttcs/discovered-ids.json");

async function main(): Promise<void> {
  const args = process.argv.slice(2).map((username) => username.replace(/^@/, ""));
  const categoryByUsername = new Map(
    DEFAULT_TARGET_ACCOUNTS.filter((account) => account.platform === "tiktok").map((account) => [
      account.username,
      account.category ?? "",
    ]),
  );

  const targets =
    args.length > 0
      ? args
      : DEFAULT_TARGET_ACCOUNTS.filter((account) => account.platform === "tiktok").map(
          (account) => account.username,
        );

  logger.info(`Discovering TikTok video IDs for: ${targets.map((u) => `@${u}`).join(", ")}`);

  const session = await createTikTokBrowserSession();

  try {
    const loggedIn = await ensureTikTokLogin(session.page, session.context);
    if (!loggedIn) {
      logger.warn("TikTok not logged in — discovery may return partial results");
    }

    const client = TikTokClient.fromPage(session.page);
    const accounts: Array<{ username: string; videoIds: string[] }> = [];

    for (const username of targets) {
      const category = categoryByUsername.get(username) ?? "";
      logger.info(`Discovering @${username}…`);

      try {
        const { posts } = await client.scrapeAccount(username, category, loggedIn);
        const videoIds = [...new Set(posts.map((post) => post.postId))];
        accounts.push({ username, videoIds });
        logger.info(`@${username}: discovered ${videoIds.length} video IDs`);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger.error(`@${username}: discovery failed — ${message}`);
        accounts.push({ username, videoIds: [] });
      }
    }

    mkdirSync(dirname(OUTPUT_PATH), { recursive: true });
    writeFileSync(OUTPUT_PATH, JSON.stringify({ accounts }, null, 2), "utf8");
    logger.info(`Saved discovery file: ${OUTPUT_PATH}`);

    const totalIds = accounts.reduce((sum, account) => sum + account.videoIds.length, 0);
    if (totalIds === 0) {
      logger.error("No video IDs discovered — run npm run tiktok:login first");
      process.exit(1);
    }
  } finally {
    await closeBrowserSession(session);
  }
}

main().catch((error) => {
  logger.error("TikTok discovery failed", error);
  process.exit(1);
});
