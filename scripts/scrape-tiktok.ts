import { DEFAULT_TARGET_ACCOUNTS } from "@/config/accounts";
import { runTikTokScrape } from "@/services/tiktok-orchestrator";
import { logger } from "@/utils/logger";

async function main(): Promise<void> {
  const usernames = process.argv.slice(2);

  const targets =
    usernames.length > 0
      ? usernames.map((username) => ({
          platform: "tiktok" as const,
          username: username.replace(/^@/, ""),
        }))
      : DEFAULT_TARGET_ACCOUNTS.filter((account) => account.platform === "tiktok");

  logger.info(`Starting TikTok scrape for: ${targets.map((t) => `@${t.username}`).join(", ")}`);

  const result = await runTikTokScrape(targets);

  for (const account of result.accounts) {
    if (account.success) {
      logger.info(
        `@${account.username}: ${account.postsCollected} posts (${account.postsInserted} new, ${account.postsUpdated} updated)`,
      );
    } else {
      logger.error(`@${account.username}: ${account.error}`);
    }
  }

  logger.info(`Consolidated CSV: ${result.csv.consolidatedPath}`);
  logger.info(`Daily snapshot: ${result.csv.snapshotPath}`);
  logger.info(`History snapshot: ${result.csv.historyPath}`);
}

main().catch((error) => {
  logger.error("TikTok scrape failed", error);
  process.exit(1);
});
