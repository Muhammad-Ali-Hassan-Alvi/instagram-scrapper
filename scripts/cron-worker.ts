import { startCronWorker } from "../src/services/cron-worker";
import { logger } from "../src/utils/logger";

logger.info("Instagram scraper cron worker running — press Ctrl+C to stop");

startCronWorker();

process.on("SIGINT", () => {
  logger.info("Cron worker stopped");
  process.exit(0);
});

process.on("SIGTERM", () => {
  logger.info("Cron worker stopped");
  process.exit(0);
});
