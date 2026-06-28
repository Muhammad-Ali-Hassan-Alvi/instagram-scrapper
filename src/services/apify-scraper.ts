import { ApifyClient } from "apify-client";

import { DEFAULT_TARGET_ACCOUNTS, type TargetAccount } from "@/config/accounts";
import {
  getApifyInstagramActorId,
  getApifyTikTokActorId,
} from "@/lib/apify-config";
import { connectDB } from "@/lib/db";
import { formatApifyUserError, isApifyQuotaError } from "@/services/apify-errors";
import {
  fetchAllDatasetItems,
  importInstagramApifyItems,
  importTikTokApifyItems,
} from "@/services/apify-import-service";
import {
  findTargetAccount,
  getApifySettingsPublic,
  markRemainingAccountsSkipped,
  requireApifyToken,
  updateAccountRun,
  updateApifyScrapeState,
} from "@/services/apify-settings";
import type { ApifyInstagramItem } from "@/scrapers/instagram/apify-import";
import type { ApifyTikTokItem } from "@/scrapers/tiktok/apify-import";
import { logger } from "@/utils/logger";

let scrapeInProgress = false;

export function isApifyScrapeInProgress(): boolean {
  return scrapeInProgress;
}

function accountLabel(account: Pick<TargetAccount, "platform" | "username">): string {
  return `${account.platform} @${account.username}`;
}

async function runApifyScrapeAccount(
  client: ApifyClient,
  account: TargetAccount,
): Promise<number> {
  const actorId = actorIdForPlatform(account.platform);

  await updateAccountRun(account, {
    status: "running",
    actorId,
    startedAt: new Date(),
    completedAt: null,
    posts: 0,
    error: null,
    message: `Starting ${actorId}…`,
  });

  if (account.platform === "tiktok") {
    await updateAccountRun(account, {
      message: `Running ${actorId} for @${account.username}…`,
    });

    const run = await client.actor(actorId).call(
      {
        profiles: [account.username],
        resultsPerPage: 2000,
        shouldDownloadVideos: false,
        shouldDownloadCovers: false,
      },
      { waitSecs: 3600 },
    );

    const items = await fetchAllDatasetItems<ApifyTikTokItem>(client, run.defaultDatasetId);

    await updateAccountRun(account, {
      message: `Importing ${items.length} TikTok items…`,
    });

    const result = await importTikTokApifyItems(items, [account], {
      onImportProgress: async (saved, total) => {
        await updateAccountRun(account, {
          message: `Saving to MongoDB… ${saved}/${total}`,
          posts: saved,
        });
      },
    });
    const posts = result.accounts[0]?.posts ?? 0;

    await updateAccountRun(account, {
      status: "success",
      completedAt: new Date(),
      posts,
      error: null,
      message: `Finished — imported ${posts} posts`,
    });

    return posts;
  }

  await updateAccountRun(account, {
    message: `Running ${actorId} for @${account.username}…`,
  });

  const run = await client.actor(actorId).call(
    {
      directUrls: [`https://www.instagram.com/${account.username}/`],
      resultsType: "posts",
      resultsLimit: 2000,
    },
    { waitSecs: 3600 },
  );

  const items = await fetchAllDatasetItems<ApifyInstagramItem>(client, run.defaultDatasetId);

  await updateAccountRun(account, {
    message: `Importing ${items.length} Instagram items…`,
  });

  const result = await importInstagramApifyItems(items, [account], {
    onImportProgress: async (saved, total) => {
      await updateAccountRun(account, {
        message: `Saving to MongoDB… ${saved}/${total}`,
        posts: saved,
      });
    },
  });
  const posts = result.accounts[0]?.posts ?? 0;

  await updateAccountRun(account, {
    status: "success",
    completedAt: new Date(),
    posts,
    error: null,
    message: `Finished — imported ${posts} posts`,
  });

  return posts;
}

function actorIdForPlatform(platform: TargetAccount["platform"]): string {
  return platform === "tiktok" ? getApifyTikTokActorId() : getApifyInstagramActorId();
}

function buildSummaryFromRuns(
  accounts: TargetAccount[],
  postsByAccount: Map<string, number>,
): {
  tiktokPosts: number;
  instagramPosts: number;
  accounts: { platform: string; username: string; posts: number }[];
} {
  const summaryAccounts = accounts.map((account) => {
    const posts = postsByAccount.get(`${account.platform}:${account.username}`) ?? 0;
    return { platform: account.platform, username: account.username, posts };
  });

  return {
    tiktokPosts: summaryAccounts
      .filter((row) => row.platform === "tiktok")
      .reduce((sum, row) => sum + row.posts, 0),
    instagramPosts: summaryAccounts
      .filter((row) => row.platform === "instagram")
      .reduce((sum, row) => sum + row.posts, 0),
    accounts: summaryAccounts,
  };
}

async function handleAccountFailure(
  account: TargetAccount,
  error: unknown,
  stopRemaining: boolean,
): Promise<void> {
  const message = formatApifyUserError(error);

  await updateAccountRun(account, {
    status: "error",
    completedAt: new Date(),
    error: message,
    message,
  });

  if (stopRemaining) {
    await markRemainingAccountsSkipped(
      account,
      "Skipped — previous account hit Apify credit limit. Update token and run this account.",
    );
  }
}

export async function runApifyScrapeAccounts(accounts: TargetAccount[]): Promise<void> {
  if (scrapeInProgress) {
    throw new Error("An Apify scrape is already running.");
  }

  scrapeInProgress = true;

  try {
    await connectDB();
    const token = await requireApifyToken();
    const client = new ApifyClient({ token });
    const postsByAccount = new Map<string, number>();
    let quotaStopped = false;

    await updateApifyScrapeState({
      scrapeStatus: "running",
      scrapePhase: accounts.length === 1 ? accounts[0].username : "batch",
      scrapeMessage:
        accounts.length === 1
          ? `Scraping ${accountLabel(accounts[0])}…`
          : `Running ${accounts.length} accounts one by one…`,
      lastScrapeError: null,
    });

    for (const account of accounts) {
      await updateApifyScrapeState({
        scrapePhase: account.username,
        scrapeMessage: `Scraping ${accountLabel(account)}…`,
      });

      try {
        const posts = await runApifyScrapeAccount(client, account);
        postsByAccount.set(`${account.platform}:${account.username}`, posts);
        logger.info(`Apify ${accountLabel(account)}: imported ${posts} posts`);
      } catch (error) {
        const quotaError = isApifyQuotaError(error);
        await handleAccountFailure(account, error, quotaError);

        if (quotaError) {
          quotaStopped = true;
          const stopMessage = `Stopped at ${accountLabel(account)} — Apify credit limit reached. Accounts before this one finished successfully. Update your token and run the remaining accounts.`;

          await updateApifyScrapeState({
            scrapeStatus: "error",
            scrapePhase: account.username,
            scrapeMessage: stopMessage,
            lastScrapeAt: new Date(),
            lastScrapeError: stopMessage,
            lastScrapeSummary: buildSummaryFromRuns(
              DEFAULT_TARGET_ACCOUNTS.filter((row) => postsByAccount.has(`${row.platform}:${row.username}`)),
              postsByAccount,
            ),
          });

          throw new Error(stopMessage);
        }

        logger.error(`Apify ${accountLabel(account)} failed`, error);
      }
    }

    const summary = buildSummaryFromRuns(
      DEFAULT_TARGET_ACCOUNTS.filter((row) => postsByAccount.has(`${row.platform}:${row.username}`)),
      postsByAccount,
    );

    await updateApifyScrapeState({
      scrapeStatus: quotaStopped ? "error" : "success",
      scrapePhase: "complete",
      scrapeMessage: quotaStopped
        ? "Batch stopped early because of an Apify limit."
        : `Finished ${accounts.length} account run(s) — ${summary.tiktokPosts + summary.instagramPosts} posts imported.`,
      lastScrapeAt: new Date(),
      lastScrapeError: quotaStopped ? "Some accounts were not run due to Apify limits." : null,
      lastScrapeSummary: summary,
    });
  } catch (error) {
    if (!isApifyQuotaError(error)) {
      const message = formatApifyUserError(error);
      logger.error("Apify scrape failed", error);

      await updateApifyScrapeState({
        scrapeStatus: "error",
        scrapePhase: "error",
        scrapeMessage: message,
        lastScrapeAt: new Date(),
        lastScrapeError: message,
      });
    }

    throw error instanceof Error ? error : new Error(formatApifyUserError(error));
  } finally {
    scrapeInProgress = false;
  }
}

export async function runApifyScrapeAll(): Promise<void> {
  await runApifyScrapeAccounts(DEFAULT_TARGET_ACCOUNTS);
}

export async function runApifyScrapeOne(
  platform: "instagram" | "tiktok",
  username: string,
): Promise<void> {
  const account = findTargetAccount(platform, username);
  if (!account) {
    throw new Error(`Unknown account: ${platform} @${username}`);
  }

  await runApifyScrapeAccounts([account]);
}

export async function startApifyScrapeBackground(options?: {
  platform?: "instagram" | "tiktok";
  username?: string;
}): Promise<{ started: boolean; error?: string }> {
  const settings = await getApifySettingsPublic();

  if (scrapeInProgress || settings.scrapeStatus === "running") {
    return { started: false, error: "An Apify scrape is already running." };
  }

  if (!settings.hasToken) {
    return { started: false, error: "Save your Apify API token before scraping." };
  }

  const runner =
    options?.platform && options?.username
      ? () => runApifyScrapeOne(options.platform!, options.username!)
      : () => runApifyScrapeAll();

  void runner().catch(() => {
    // Errors are persisted in ApifySettings.
  });

  return { started: true };
}
