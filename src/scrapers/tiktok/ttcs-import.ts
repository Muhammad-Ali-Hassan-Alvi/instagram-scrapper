import { PostType } from "@/models/Post";
import { extractHashtags, extractMentions } from "@/scrapers/instagram/parsers";
import type { ScrapedPost, ScrapedProfile } from "@/scrapers/shared/types";

/** TikTok-Content-Scraper content_metadata/*.json shape (filtered output). */
export interface TtcsContentMetadata {
  video_metadata?: {
    id?: number | string;
    time_created?: string;
    author_id?: number | string;
    description?: string | null;
    diggcount?: number | null;
    sharecount?: number | null;
    commentcount?: number | null;
    playcount?: number | null;
    collectcount?: number | null;
  };
  file_metadata?: {
    duration?: number | null;
  };
  author_metadata?: {
    id?: number | string;
    username?: string | null;
    name?: string | null;
    signature?: string | null;
    verified?: boolean | null;
  };
}

/** TikTok-Content-Scraper user_metadata/*.json shape (raw userInfo). */
export interface TtcsUserMetadata {
  user?: {
    id?: string;
    uniqueId?: string;
    nickname?: string;
    signature?: string;
    avatarLarger?: string;
    verified?: boolean;
    privateAccount?: boolean;
  };
  stats?: {
    followerCount?: number;
    followingCount?: number;
    videoCount?: number;
  };
}

function normalizeDuration(raw: number | null | undefined): number | null {
  if (raw == null || Number.isNaN(raw)) return null;
  // TTCS stores TikTok duration; values >600 are usually milliseconds.
  return raw > 600 ? Math.round(raw / 1000) : Math.round(raw);
}

export function mapTtcsContentToScrapedPost(
  metadata: TtcsContentMetadata,
  category: string,
  accountUsername?: string,
): ScrapedPost | null {
  const video = metadata.video_metadata;
  const author = metadata.author_metadata;
  if (!video?.id) return null;

  const username =
    accountUsername?.trim() ||
    author?.username?.trim() ||
    "";
  if (!username) return null;

  const postId = String(video.id);
  const caption = video.description ?? "";
  const postedAt = video.time_created ? new Date(video.time_created) : new Date(0);
  if (Number.isNaN(postedAt.getTime())) return null;

  return {
    platform: "tiktok",
    accountUsername: username,
    accountId: String(video.author_id ?? author?.id ?? username),
    category,
    postId,
    shortcode: postId,
    postUrl: `https://www.tiktok.com/@${username}/video/${postId}`,
    type: PostType.Video,
    caption,
    hashtags: extractHashtags(caption),
    mentions: extractMentions(caption),
    mediaUrl: "",
    thumbnailUrl: "",
    postedAt,
    likes: video.diggcount ?? 0,
    comments: video.commentcount ?? 0,
    shares: video.sharecount ?? 0,
    saves: video.collectcount ?? 0,
    views: video.playcount ?? 0,
    duration: normalizeDuration(metadata.file_metadata?.duration),
  };
}

export function buildTtcsProfile(
  username: string,
  userMetadata: TtcsUserMetadata | null,
  category: string,
  importedPostCount: number,
): ScrapedProfile {
  const user = userMetadata?.user;
  const stats = userMetadata?.stats;

  return {
    platform: "tiktok",
    accountId: user?.id ?? username,
    username: user?.uniqueId ?? username,
    displayName: user?.nickname ?? username,
    biography: user?.signature ?? "",
    profileImage: user?.avatarLarger ?? "",
    followers: stats?.followerCount ?? 0,
    following: stats?.followingCount ?? 0,
    totalPosts: Math.max(stats?.videoCount ?? 0, importedPostCount),
    verified: user?.verified ?? false,
    isPrivate: user?.privateAccount ?? false,
    category,
  };
}

export function filterTtcsPostsForAccount(
  posts: ScrapedPost[],
  username: string,
): ScrapedPost[] {
  const target = username.toLowerCase();
  return posts.filter((post) => post.accountUsername.toLowerCase() === target);
}
