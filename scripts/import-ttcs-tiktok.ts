import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { DEFAULT_TARGET_ACCOUNTS } from "@/config/accounts";
import { connectDB } from "@/lib/db";
import { Account } from "@/models/Account";
import type { ScrapedPost, ScrapedProfile } from "@/scrapers/shared/types";
import {
  buildTtcsProfile,
  filterTtcsPostsForAccount,
  mapTtcsContentToScrapedPost,
  type TtcsContentMetadata,
  type TtcsUserMetadata,
} from "@/scrapers/tiktok/ttcs-import";
import { persistPosts, upsertAccount } from "@/services/persistence";
import { logger } from "@/utils/logger";

function readJsonFile<T>(filePath: string): T {
  return JSON.parse(readFileSync(filePath, "utf8")) as T;
}

function parseArgs(): { dataDir: string; usernames: string[] } {
  const args = process.argv.slice(2);
  const dirArgIndex = args.findIndex((arg) => arg === "--dir" || arg === "-d");
  const dataDir =
    dirArgIndex >= 0 && args[dirArgIndex + 1]
      ? resolve(args[dirArgIndex + 1])
      : resolve("data/ttcs");

  const usernames = args
    .filter((arg, index) => {
      if (arg.startsWith("-")) return false;
      if (dirArgIndex >= 0 && (index === dirArgIndex + 1 || index === dirArgIndex)) {
        return false;
      }
      return true;
    })
    .map((username) => username.replace(/^@/, "").toLowerCase());

  return { dataDir, usernames };
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
    followers: profile.followers || existing.followers,
    following: profile.following || existing.following,
    verified: existing.verified || profile.verified,
    isPrivate: existing.private || profile.isPrivate,
    totalPosts: importedPostCount ?? Math.max(existing.totalPosts, profile.totalPosts),
    profileImage: profile.profileImage || existing.profileImage,
  });
}

function loadContentPosts(dataDir: string, categoryByUsername: Map<string, string>): ScrapedPost[] {
  const contentDir = join(dataDir, "content_metadata");
  let files: string[];
  try {
    files = readdirSync(contentDir).filter((name) => name.endsWith(".json"));
  } catch {
    throw new Error(`Missing ${contentDir} — run npm run scrape:tiktok:ttcs first`);
  }
  const posts: ScrapedPost[] = [];

  for (const filename of files) {
    const metadata = readJsonFile<TtcsContentMetadata>(join(contentDir, filename));
    const username = metadata.author_metadata?.username ?? undefined;
    const category = username ? (categoryByUsername.get(username.toLowerCase()) ?? "") : "";
    const post = mapTtcsContentToScrapedPost(metadata, category, username);
    if (post) posts.push(post);
  }

  return posts;
}

function loadUserMetadata(dataDir: string, username: string): TtcsUserMetadata | null {
  const userPath = join(dataDir, "user_metadata", `${username}.json`);
  try {
    return readJsonFile<TtcsUserMetadata>(userPath);
  } catch {
    return null;
  }
}

async function main(): Promise<void> {
  const { dataDir, usernames } = parseArgs();
  const categoryByUsername = new Map(
    DEFAULT_TARGET_ACCOUNTS.filter((account) => account.platform === "tiktok").map((account) => [
      account.username.toLowerCase(),
      account.category ?? "",
    ]),
  );

  const targetUsernames =
    usernames.length > 0 ? usernames : [...categoryByUsername.keys()];

  logger.info(`Importing TTCS TikTok data from ${dataDir}`);
  await connectDB();

  const allPosts = loadContentPosts(dataDir, categoryByUsername);
  let totalInserted = 0;
  let totalUpdated = 0;
  let totalPosts = 0;

  for (const username of targetUsernames) {
    const category = categoryByUsername.get(username) ?? "";
    const posts = filterTtcsPostsForAccount(allPosts, username);
    if (posts.length === 0) {
      logger.warn(`@${username}: no TTCS content_metadata posts found`);
      continue;
    }

    const userMetadata = loadUserMetadata(dataDir, username);
    const profile = buildTtcsProfile(username, userMetadata, category, posts.length);
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
    `TTCS import complete — ${totalPosts} posts (${totalInserted} new, ${totalUpdated} updated)`,
  );
}

main().catch((error) => {
  logger.error("TTCS TikTok import failed", error);
  process.exit(1);
});
