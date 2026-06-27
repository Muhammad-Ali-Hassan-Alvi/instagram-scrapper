import { logger } from "@/utils/logger";

import { acquireScrapeLock, releaseScrapeLock } from "@/lib/scrape-lock";
import {
  markScrapeComplete,
  markScrapeIdle,
  resetScrapeState,
  setScrapeError,
} from "./scrape-state";
import { runInstagramScrape, type OrchestratorResult } from "./scrape-orchestrator";

let scrapeInProgress = false;

/**
 * Runs the daily scrape with overlap protection.
 * Safe to call from cron workers and CLI scripts only.
 */
export async function executeScheduledScrape(): Promise<OrchestratorResult | null> {
  if (scrapeInProgress) {
    logger.warn("Scheduled scrape skipped — previous run still in progress (same process)");
    return null;
  }

  if (!acquireScrapeLock()) {
    logger.warn("Scheduled scrape skipped — lock file exists (another scrape process)");
    return null;
  }

  scrapeInProgress = true;
  resetScrapeState();
  const startedAt = new Date();

  try {
    logger.info(`Scheduled scrape started at ${startedAt.toISOString()}`);
    const result = await runInstagramScrape();
    const durationSec = Math.round((Date.now() - startedAt.getTime()) / 1000);

    markScrapeComplete();
    logger.info(
      `Scheduled scrape finished in ${durationSec}s — ${result.csv.rowCount} CSV rows, ${result.accounts.filter((a) => a.success).length}/${result.accounts.length} accounts OK`,
    );

    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Scrape failed";
    setScrapeError(message);
    logger.error("Scheduled scrape failed", error);
    throw error;
  } finally {
    scrapeInProgress = false;
    markScrapeIdle();
    releaseScrapeLock();
  }
}

export function isScrapeInProgress(): boolean {
  return scrapeInProgress;
}

/** Fire-and-forget scrape for visit bootstrap. Returns false if already running. */
export function startBackgroundScrape(): boolean {
  if (scrapeInProgress) {
    return false;
  }

  void executeScheduledScrape().catch((error) => {
    logger.error("Background scrape failed", error);
  });

  return true;
}
