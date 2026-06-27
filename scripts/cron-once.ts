import { executeScheduledScrape } from "../src/services/cron-job";
import { logger } from "../src/utils/logger";

async function main(): Promise<void> {
  const result = await executeScheduledScrape();
  if (!result) {
    logger.warn("Scrape skipped");
    process.exit(0);
  }
  logger.info(`Done — ${result.csv.rowCount} rows exported`);
}

main().catch((error) => {
  logger.error("Scrape failed", error);
  process.exit(1);
});
