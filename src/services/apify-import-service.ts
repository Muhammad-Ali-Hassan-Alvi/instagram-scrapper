import type { ApifyClient } from "apify-client";

import type { TargetAccount } from "@/config/accounts";
import { Account } from "@/models/Account";
import {
  buildApifyInstagramProfile,
  dedupeApifyInstagramItems,
  filterApifyInstagramItemsForAccount,
  mapApifyInstagramItemToScrapedPost,
  type ApifyInstagramItem,
} from "@/scrapers/instagram/apify-import";
import {
  buildApifyProfile,
  dedupeApifyItems,
  filterApifyItemsForAccount,
  mapApifyItemToScrapedPost,
  type ApifyTikTokItem,
} from "@/scrapers/tiktok/apify-import";
import type { ScrapedProfile } from "@/scrapers/shared/types";
import type { ApifyScrapeSummary } from "@/models/ApifySettings";
import { persistPosts, upsertAccount } from "@/services/persistence";
import { logger } from "@/utils/logger";

export interface ApifyImportOptions {
  onImportProgress?: (saved: number, total: number) => void | Promise<void>;
}

async function upsertAccountPreservingStats(
  profile: ScrapedProfile,
  importedPostCount?: number,
) {
  const existing = await Account.findOne({
    username: profile.username,
    platform: profile.platform,
  });

  if (!existing) {
    return upsertAccount({
      ...profile,
      totalPosts: importedPostCount ?? profile.totalPosts,
    });
  }

  return upsertAccount({
    ...profile,
    accountId: existing.accountId || profile.accountId,
    displayName: existing.displayName || profile.displayName,
    biography: existing.biography || profile.biography,
    followers: existing.followers || profile.followers,
    following: existing.following || profile.following,
    verified: existing.verified || profile.verified,
    isPrivate: existing.private || profile.isPrivate,
    totalPosts: importedPostCount ?? Math.max(existing.totalPosts, profile.totalPosts),
    profileImage: profile.profileImage || existing.profileImage,
  });
}

export async function importTikTokApifyItems(
  items: ApifyTikTokItem[],
  accounts: TargetAccount[],
  options?: ApifyImportOptions,
): Promise<{ posts: number; accounts: ApifyScrapeSummary["accounts"] }> {
  const summaryAccounts: ApifyScrapeSummary["accounts"] = [];
  let totalPosts = 0;

  for (const account of accounts) {
    const authorItems = dedupeApifyItems(
      filterApifyItemsForAccount(items, account.username),
    );

    if (authorItems.length === 0) {
      logger.warn(`Apify TikTok @${account.username}: no posts returned`);
      summaryAccounts.push({
        platform: "tiktok",
        username: account.username,
        posts: 0,
      });
      continue;
    }

    const category = account.category ?? "";
    const profile = buildApifyProfile(account.username, authorItems, category);
    const posts = authorItems
      .map((item) => mapApifyItemToScrapedPost(item, category, account.username))
      .filter((post): post is NonNullable<typeof post> => post != null);

    const accountDoc = await upsertAccountPreservingStats(profile, posts.length);
    await persistPosts(accountDoc._id, posts, {
      onProgress: options?.onImportProgress,
    });

    totalPosts += posts.length;
    summaryAccounts.push({
      platform: "tiktok",
      username: account.username,
      posts: posts.length,
    });

    logger.info(`Apify TikTok @${account.username}: imported ${posts.length} posts`);
  }

  return { posts: totalPosts, accounts: summaryAccounts };
}

export async function importInstagramApifyItems(
  items: ApifyInstagramItem[],
  accounts: TargetAccount[],
  options?: ApifyImportOptions,
): Promise<{ posts: number; accounts: ApifyScrapeSummary["accounts"] }> {
  const summaryAccounts: ApifyScrapeSummary["accounts"] = [];
  let totalPosts = 0;

  for (const account of accounts) {
    const authorItems = dedupeApifyInstagramItems(
      filterApifyInstagramItemsForAccount(items, account.username),
    );

    if (authorItems.length === 0) {
      logger.warn(`Apify Instagram @${account.username}: no posts returned`);
      summaryAccounts.push({
        platform: "instagram",
        username: account.username,
        posts: 0,
      });
      continue;
    }

    const category = account.category ?? "";
    const profile = buildApifyInstagramProfile(account.username, authorItems, category);
    const posts = authorItems
      .map((item) => mapApifyInstagramItemToScrapedPost(item, category, account.username))
      .filter((post): post is NonNullable<typeof post> => post != null);

    const accountDoc = await upsertAccountPreservingStats(profile, posts.length);
    await persistPosts(accountDoc._id, posts, {
      onProgress: options?.onImportProgress,
    });

    totalPosts += posts.length;
    summaryAccounts.push({
      platform: "instagram",
      username: account.username,
      posts: posts.length,
    });

    logger.info(`Apify Instagram @${account.username}: imported ${posts.length} posts`);
  }

  return { posts: totalPosts, accounts: summaryAccounts };
}

export async function fetchAllDatasetItems<T>(
  client: ApifyClient,
  datasetId: string,
): Promise<T[]> {
  const items: T[] = [];
  const limit = 1000;
  let offset = 0;

  while (true) {
    const page = await client.dataset(datasetId).listItems({ limit, offset });
    items.push(...(page.items as T[]));
    if (page.items.length < limit) break;
    offset += limit;
  }

  return items;
}
