import { executeScheduledScrape } from "../src/services/cron-job";
import { logger } from "../src/utils/logger";

async function main(): Promise<void> {
  const result = await executeScheduledScrape();
  if (!result) {
    logger.warn("Scrape skipped");
    process.exit(0);
  }
  const rowCount = result.instagram.csv.rowCount;
  logger.info(`Done — ${rowCount} rows exported (Instagram + TikTok)`);
}

main().catch((error) => {
  logger.error("Scrape failed", error);
  process.exit(1);
});
