import cron, { type ScheduledTask } from "node-cron";

import { getEnv } from "@/config/env";
import { executeScheduledScrape } from "@/services/cron-job";
import { logger } from "@/utils/logger";

export interface CronWorkerOptions {
  schedule?: string;
  timezone?: string;
  runOnStart?: boolean;
}

function isValidCronSchedule(schedule: string): boolean {
  return cron.validate(schedule);
}

/**
 * Starts a background scheduler that runs the Instagram scrape on a cron interval.
 * Default: every day at 06:00 (server local time or CRON_TZ).
 */
export function startCronWorker(options: CronWorkerOptions = {}): ScheduledTask {
  const env = getEnv();
  const schedule = options.schedule ?? env.CRON_SCHEDULE;
  const timezone = options.timezone ?? env.CRON_TZ;
  const runOnStart = options.runOnStart ?? env.RUN_SCRAPE_ON_START;

  if (!isValidCronSchedule(schedule)) {
    throw new Error(`Invalid CRON_SCHEDULE: "${schedule}"`);
  }

  logger.info(`Cron worker started — schedule: "${schedule}" (${timezone})`);

  const task = cron.schedule(
    schedule,
    () => {
      void executeScheduledScrape().catch((error) => {
        logger.error("Cron tick failed", error);
      });
    },
    { timezone },
  );

  if (runOnStart) {
    logger.info("RUN_SCRAPE_ON_START enabled — running scrape immediately");
    void executeScheduledScrape().catch((error) => {
      logger.error("Initial scrape failed", error);
    });
  }

  return task;
}
