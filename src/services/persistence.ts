import type { Types } from "mongoose";

import { Account, type AccountDocument } from "@/models/Account";
import { Post, PostType } from "@/models/Post";
import type { ScrapedPost, ScrapedProfile } from "@/scrapers/shared/types";
import { logger } from "@/utils/logger";

function mapScrapedPostType(type: ScrapedPost["type"]): PostType {
  return type;
}

export async function upsertAccount(profile: ScrapedProfile): Promise<AccountDocument> {
  const account = await Account.findOneAndUpdate(
    { username: profile.username, platform: profile.platform },
    {
      platform: profile.platform,
      username: profile.username,
      displayName: profile.displayName,
      accountId: profile.accountId,
      profileImage: profile.profileImage,
      followers: profile.followers,
      following: profile.following,
      totalPosts: profile.totalPosts,
      biography: profile.biography,
      verified: profile.verified,
      private: profile.isPrivate,
      lastScrapedAt: new Date(),
    },
    { upsert: true, returnDocument: "after", setDefaultsOnInsert: true },
  );

  return account;
}

export interface PersistPostsResult {
  inserted: number;
  updated: number;
}

export interface PersistPostsOptions {
  batchSize?: number;
  onProgress?: (saved: number, total: number) => void | Promise<void>;
}

export async function persistPosts(
  accountObjectId: Types.ObjectId,
  posts: ScrapedPost[],
  options?: PersistPostsOptions,
): Promise<PersistPostsResult> {
  let inserted = 0;
  let updated = 0;
  const scrapedAt = new Date();
  const batchSize = options?.batchSize ?? 100;

  for (let index = 0; index < posts.length; index += batchSize) {
    const batch = posts.slice(index, index + batchSize);
    const existingPostIds = new Set(
      (
        await Post.find({
          accountId: accountObjectId,
          postId: { $in: batch.map((post) => post.postId) },
        })
          .select("postId")
          .lean()
      ).map((post) => post.postId),
    );

    await Post.bulkWrite(
      batch.map((post) => ({
        updateOne: {
          filter: {
            accountId: accountObjectId,
            postId: post.postId,
          },
          update: {
            $set: {
              accountId: accountObjectId,
              platform: post.platform,
              postId: post.postId,
              shortcode: post.shortcode,
              type: mapScrapedPostType(post.type),
              caption: post.caption,
              hashtags: post.hashtags,
              mentions: post.mentions,
              mediaUrl: post.mediaUrl,
              thumbnailUrl: post.thumbnailUrl,
              postedAt: post.postedAt,
              likes: post.likes,
              comments: post.comments,
              shares: post.shares,
              saves: post.saves,
              views: post.views,
              duration: post.duration,
              scrapedAt,
            },
          },
          upsert: true,
        },
      })),
      { ordered: false },
    );

    for (const post of batch) {
      if (existingPostIds.has(post.postId)) updated++;
      else inserted++;
    }

    const saved = Math.min(index + batch.length, posts.length);
    if (options?.onProgress) {
      await options.onProgress(saved, posts.length);
    }
  }

  logger.info(`Persisted posts — inserted: ${inserted}, updated: ${updated}`);
  return { inserted, updated };
}

export async function loadAllPostsForExport(): Promise<
  Array<{
    account: AccountDocument;
    posts: Awaited<ReturnType<typeof Post.find>>;
  }>
> {
  const accounts = await Account.find().sort({ platform: 1, username: 1 });
  const results = [];

  for (const account of accounts) {
    const posts = await Post.find({ accountId: account._id }).sort({ postedAt: -1 });
    results.push({ account, posts });
  }

  return results;
}
