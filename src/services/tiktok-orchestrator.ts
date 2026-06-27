import { DEFAULT_TARGET_ACCOUNTS, type TargetAccount } from "@/config/accounts";
import { connectDB } from "@/lib/db";
import { ScrapeLog } from "@/models/ScrapeLog";
import {
  closeBrowserSession,
  createTikTokBrowserSession,
  saveTikTokSession,
} from "@/playwright/browser";
import { ensureTikTokLogin } from "@/playwright/tiktok-auth";
import { TikTokClient } from "@/scrapers/tiktok/client";
import {
  appendHistoricalCsvSnapshot,
  writeConsolidatedCsv,
} from "@/services/csv-export";
import {
  buildConsolidatedExportRows,
  scrapedPostToConsolidatedRow,
  writePerAccountExportFiles,
} from "@/services/export-builder";
import { persistPosts, upsertAccount } from "@/services/persistence";
import {
  setAccountDone,
  setAccountFailed,
  setAccountRunning,
  setScrapePhase,
} from "@/services/scrape-state";
import type { ConsolidatedExportRow } from "@/types/consolidated-export";
import { logger } from "@/utils/logger";

import type { OrchestratorResult, ScrapeRunResult } from "./scrape-orchestrator";

async function scrapeTikTokAccount(
  client: TikTokClient,
  target: TargetAccount,
  loggedIn: boolean,
): Promise<ScrapeRunResult> {
  const startedAt = Date.now();
  const log = await ScrapeLog.create({
    platform: "tiktok",
    username: target.username,
    startedAt: new Date(startedAt),
    success: false,
    pagesScraped: 0,
    postsInserted: 0,
    postsUpdated: 0,
    errorMessage: null,
  });

  try {
    const category = target.category ?? "";
    setAccountRunning(target.username);
    const { profile, posts, pagesScraped } = await client.scrapeAccount(
      target.username,
      category,
      loggedIn,
    );
    setAccountRunning(target.username, profile.totalPosts);
    setAccountDone(target.username, posts.length, profile.totalPosts);

    const accountDoc = await upsertAccount(profile);
    const { inserted, updated } = await persistPosts(accountDoc._id, posts);

    await ScrapeLog.findByIdAndUpdate(log._id, {
      completedAt: new Date(),
      durationMs: Date.now() - startedAt,
      success: true,
      pagesScraped,
      postsInserted: inserted,
      postsUpdated: updated,
    });

    return {
      username: target.username,
      success: true,
      postsCollected: posts.length,
      postsInserted: inserted,
      postsUpdated: updated,
      pagesScraped,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    setAccountFailed(target.username, message);
    await ScrapeLog.findByIdAndUpdate(log._id, {
      completedAt: new Date(),
      durationMs: Date.now() - startedAt,
      success: false,
      errorMessage: message,
    });

    return {
      username: target.username,
      success: false,
      postsCollected: 0,
      postsInserted: 0,
      postsUpdated: 0,
      pagesScraped: 0,
      error: message,
    };
  }
}

export async function runTikTokScrape(
  targets: TargetAccount[] = DEFAULT_TARGET_ACCOUNTS.filter(
    (account) => account.platform === "tiktok",
  ),
): Promise<OrchestratorResult> {
  const startedAt = new Date();
  let dbConnected = false;

  try {
    await connectDB();
    dbConnected = true;
  } catch (error) {
    logger.warn(
      "MongoDB unavailable — scrape cannot persist; run with MONGO_URI configured",
      error instanceof Error ? error.message : error,
    );
  }

  const session = await createTikTokBrowserSession();
  const accounts: ScrapeRunResult[] = [];
  const fallbackRows: ConsolidatedExportRow[] = [];
  const dataRefresh = new Date();

  try {
    setScrapePhase("login", "Logging into TikTok…");
    const loggedIn = await ensureTikTokLogin(session.page, session.context);

    if (!loggedIn) {
      logger.warn(
        "TikTok not authenticated — profile metadata only; run npm run tiktok:login for full video history",
      );
    } else {
      await saveTikTokSession(session.context);
    }

    setScrapePhase("scraping", "Collecting TikTok posts from target accounts…");

    const client = TikTokClient.fromPage(session.page);
    const tiktokTargets = targets.filter((target) => target.platform === "tiktok");
    const categoryByUsername = new Map(
      DEFAULT_TARGET_ACCOUNTS.map((target) => [target.username, target.category ?? ""]),
    );

    for (const target of tiktokTargets) {
      logger.info(`Scraping TikTok @${target.username}`);
      setAccountRunning(target.username);

      if (dbConnected) {
        const result = await scrapeTikTokAccount(client, target, loggedIn);
        accounts.push(result);
        if (!result.success) {
          logger.error(`Failed @${target.username}: ${result.error}`);
        }
      } else {
        try {
          const category = target.category ?? categoryByUsername.get(target.username) ?? "";
          const { profile, posts, pagesScraped } = await client.scrapeAccount(
            target.username,
            category,
            loggedIn,
          );
          for (const post of posts) {
            fallbackRows.push(scrapedPostToConsolidatedRow(post, profile.followers, dataRefresh));
          }
          accounts.push({
            username: target.username,
            success: true,
            postsCollected: posts.length,
            postsInserted: posts.length,
            postsUpdated: 0,
            pagesScraped,
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          accounts.push({
            username: target.username,
            success: false,
            postsCollected: 0,
            postsInserted: 0,
            postsUpdated: 0,
            pagesScraped: 0,
            error: message,
          });
          logger.error(`Failed @${target.username}: ${message}`);
        }
      }
    }

    if (loggedIn) {
      await saveTikTokSession(session.context);
    }
  } finally {
    await closeBrowserSession(session);
  }

  const rows = dbConnected
    ? await buildConsolidatedExportRows(dataRefresh)
    : fallbackRows.sort((a, b) => {
        const accountCompare = String(a.Account_ID).localeCompare(String(b.Account_ID));
        if (accountCompare !== 0) return accountCompare;
        return String(b.Post_Date).localeCompare(String(a.Post_Date));
      });

  const exported = writeConsolidatedCsv(rows, dataRefresh);
  const historyPath = appendHistoricalCsvSnapshot(rows, dataRefresh);
  setScrapePhase("exporting", "Writing exports…");
  const accountFiles = dbConnected ? await writePerAccountExportFiles(dataRefresh) : [];
  const completedAt = new Date();

  logger.info(
    `Data saved — ${exported.rowCount} rows in MongoDB/CSV snapshot (${dbConnected ? "database" : "csv-only fallback"})`,
  );
  if (accountFiles.length) {
    logger.info(`Per-account CSVs: ${accountFiles.join(", ")}`);
  }

  return {
    startedAt,
    completedAt,
    accounts,
    csv: {
      ...exported,
      historyPath,
      rowCount: exported.rowCount,
    },
  };
}
