import { logger } from "@/utils/logger";

import { acquireScrapeLock, releaseScrapeLock } from "@/lib/scrape-lock";
import {
  markScrapeComplete,
  markScrapeIdle,
  resetScrapeState,
  setScrapeError,
} from "./scrape-state";
import { runInstagramScrape, type OrchestratorResult } from "./scrape-orchestrator";
import { runTikTokScrape } from "./tiktok-orchestrator";

export interface ScheduledScrapeResult {
  instagram: OrchestratorResult;
  tiktok: OrchestratorResult;
}

let scrapeInProgress = false;

/**
 * Runs the daily scrape with overlap protection.
 * Safe to call from cron workers and CLI scripts only.
 */
export async function executeScheduledScrape(): Promise<ScheduledScrapeResult | null> {
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

    logger.info("Running Instagram scrape…");
    const instagram = await runInstagramScrape();
    logger.info(
      `Instagram done — ${instagram.accounts.filter((a) => a.success).length}/${instagram.accounts.length} accounts OK`,
    );

    logger.info("Running TikTok scrape…");
    const tiktok = await runTikTokScrape();
    logger.info(
      `TikTok done — ${tiktok.accounts.filter((a) => a.success).length}/${tiktok.accounts.length} accounts OK`,
    );

    const durationSec = Math.round((Date.now() - startedAt.getTime()) / 1000);
    const okAccounts =
      instagram.accounts.filter((a) => a.success).length +
      tiktok.accounts.filter((a) => a.success).length;
    const totalAccounts = instagram.accounts.length + tiktok.accounts.length;

    markScrapeComplete();
    logger.info(
      `Scheduled scrape finished in ${durationSec}s — ${instagram.csv.rowCount} CSV rows, ${okAccounts}/${totalAccounts} accounts OK`,
    );

    return { instagram, tiktok };
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
