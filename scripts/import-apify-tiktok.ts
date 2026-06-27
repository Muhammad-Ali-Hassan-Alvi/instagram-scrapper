import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { DEFAULT_TARGET_ACCOUNTS } from "@/config/accounts";
import { connectDB } from "@/lib/db";
import { Account } from "@/models/Account";
import {
  buildApifyProfile,
  dedupeApifyItems,
  filterApifyItemsForAccount,
  mapApifyItemToScrapedPost,
  type ApifyTikTokItem,
} from "@/scrapers/tiktok/apify-import";
import type { ScrapedProfile } from "@/scrapers/shared/types";
import { persistPosts, upsertAccount } from "@/services/persistence";
import { logger } from "@/utils/logger";

function readApifyJson(filePath: string): ApifyTikTokItem[] {
  const raw = readFileSync(filePath, "utf8");
  const parsed: unknown = JSON.parse(raw);

  if (!Array.isArray(parsed)) {
    throw new Error(`Expected a JSON array in ${filePath}`);
  }

  return parsed as ApifyTikTokItem[];
}

function parseArgs(): { filePath: string; usernames: string[] } {
  const args = process.argv.slice(2);
  const fileArgIndex = args.findIndex((arg) => arg === "--file" || arg === "-f");
  const filePath =
    fileArgIndex >= 0 && args[fileArgIndex + 1]
      ? resolve(args[fileArgIndex + 1])
      : resolve("data/apify-tiktok-import.json");

  const usernames = args
    .filter((arg, index) => {
      if (arg.startsWith("-")) return false;
      if (fileArgIndex >= 0 && (index === fileArgIndex + 1 || index === fileArgIndex)) {
        return false;
      }
      return true;
    })
    .map((username) => username.replace(/^@/, "").toLowerCase());

  return { filePath, usernames };
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

async function main(): Promise<void> {
  const { filePath, usernames } = parseArgs();
  const items = readApifyJson(filePath);

  const categoryByUsername = new Map(
    DEFAULT_TARGET_ACCOUNTS.filter((account) => account.platform === "tiktok").map((account) => [
      account.username.toLowerCase(),
      account.category ?? "",
    ]),
  );

  const targetUsernames =
    usernames.length > 0
      ? usernames
      : [...categoryByUsername.keys()].filter((username) =>
          filterApifyItemsForAccount(items, username).length > 0,
        );

  if (targetUsernames.length === 0) {
    throw new Error(
      "No matching TikTok usernames found in the import file. Pass usernames explicitly or check the JSON path.",
    );
  }

  logger.info(`Importing Apify TikTok data from ${filePath}`);
  logger.info(`Target accounts: ${targetUsernames.map((username) => `@${username}`).join(", ")}`);

  await connectDB();

  let totalInserted = 0;
  let totalUpdated = 0;
  let totalPosts = 0;

  for (const username of targetUsernames) {
    const authorItems = dedupeApifyItems(filterApifyItemsForAccount(items, username));
    if (authorItems.length === 0) {
      logger.warn(`@${username}: no posts found in import file`);
      continue;
    }

    const category = categoryByUsername.get(username) ?? "";
    const profile = buildApifyProfile(username, authorItems, category);
    const posts = authorItems
      .map((item) => mapApifyItemToScrapedPost(item, category, username))
      .filter((post): post is NonNullable<typeof post> => post != null);

    const accountDoc = await upsertAccountPreservingStats(profile, posts.length);
    const { inserted, updated } = await persistPosts(accountDoc._id, posts);

    totalInserted += inserted;
    totalUpdated += updated;
    totalPosts += posts.length;

    logger.info(
      `@${username}: imported ${posts.length} posts (${inserted} new, ${updated} updated)`,
    );
  }

  logger.info(
    `Apify import complete — ${totalPosts} posts (${totalInserted} new, ${totalUpdated} updated)`,
  );
}

main().catch((error) => {
  logger.error("Apify TikTok import failed", error);
  process.exit(1);
});
