import { PostType } from "@/models/Post";
import { extractHashtags, extractMentions } from "@/scrapers/instagram/parsers";
import type { ScrapedPost, ScrapedProfile } from "@/scrapers/shared/types";

export interface ApifyTikTokItem {
  "authorMeta.avatar"?: string;
  "authorMeta.name"?: string;
  text?: string;
  diggCount?: number;
  shareCount?: number;
  playCount?: number;
  commentCount?: number;
  collectCount?: number;
  "videoMeta.duration"?: number;
  createTimeISO?: string;
  webVideoUrl?: string;
}

function parsePostId(webVideoUrl: string | undefined): string | null {
  if (!webVideoUrl) return null;
  const match = webVideoUrl.match(/\/video\/(\d+)/);
  return match?.[1] ?? null;
}

function parseUsernameFromVideoUrl(webVideoUrl: string | undefined): string | null {
  if (!webVideoUrl) return null;
  const match = webVideoUrl.match(/\/@([^/]+)\/video\//);
  return match?.[1]?.toLowerCase() ?? null;
}

export function filterApifyItemsForAccount(
  items: ApifyTikTokItem[],
  username: string,
): ApifyTikTokItem[] {
  const target = username.toLowerCase();

  return items.filter((item) => {
    const author = item["authorMeta.name"]?.trim().toLowerCase();
    const urlUsername = parseUsernameFromVideoUrl(item.webVideoUrl);
    return author === target || urlUsername === target;
  });
}

export function dedupeApifyItems(items: ApifyTikTokItem[]): ApifyTikTokItem[] {
  const byPostId = new Map<string, ApifyTikTokItem>();

  for (const item of items) {
    const postId = parsePostId(item.webVideoUrl);
    if (!postId) continue;

    const existing = byPostId.get(postId);
    if (!existing) {
      byPostId.set(postId, item);
      continue;
    }

    const existingTime = Date.parse(existing.createTimeISO ?? "");
    const nextTime = Date.parse(item.createTimeISO ?? "");
    if (nextTime >= existingTime) {
      byPostId.set(postId, item);
    }
  }

  return [...byPostId.values()];
}

export function mapApifyItemToScrapedPost(
  item: ApifyTikTokItem,
  category: string,
  accountUsername?: string,
): ScrapedPost | null {
  const username =
    accountUsername?.trim() ||
    item["authorMeta.name"]?.trim() ||
    parseUsernameFromVideoUrl(item.webVideoUrl) ||
    "";
  const postId = parsePostId(item.webVideoUrl);
  if (!username || !postId) return null;

  const caption = item.text ?? "";
  const postedAt = item.createTimeISO ? new Date(item.createTimeISO) : new Date(0);
  if (Number.isNaN(postedAt.getTime())) return null;

  return {
    platform: "tiktok",
    accountUsername: username,
    accountId: username,
    category,
    postId,
    shortcode: postId,
    postUrl: item.webVideoUrl ?? `https://www.tiktok.com/@${username}/video/${postId}`,
    type: PostType.Video,
    caption,
    hashtags: extractHashtags(caption),
    mentions: extractMentions(caption),
    mediaUrl: "",
    thumbnailUrl: "",
    postedAt,
    likes: item.diggCount ?? 0,
    comments: item.commentCount ?? 0,
    shares: item.shareCount ?? 0,
    saves: item.collectCount ?? 0,
    views: item.playCount ?? 0,
    duration: item["videoMeta.duration"] ?? null,
  };
}

export function buildApifyProfile(
  username: string,
  items: ApifyTikTokItem[],
  category: string,
): ScrapedProfile {
  const sample =
    items.find((item) => item["authorMeta.name"]?.trim().toLowerCase() === username.toLowerCase()) ??
    items[0];

  return {
    platform: "tiktok",
    accountId: username,
    username,
    displayName: username,
    biography: "",
    profileImage: sample?.["authorMeta.avatar"] ?? "",
    followers: 0,
    following: 0,
    totalPosts: items.length,
    verified: false,
    isPrivate: false,
    category,
  };
}

export function groupApifyItemsByAuthor(
  items: ApifyTikTokItem[],
): Map<string, ApifyTikTokItem[]> {
  const grouped = new Map<string, ApifyTikTokItem[]>();

  for (const item of items) {
    const username = item["authorMeta.name"]?.trim().toLowerCase();
    if (!username) continue;

    const bucket = grouped.get(username) ?? [];
    bucket.push(item);
    grouped.set(username, bucket);
  }

  return grouped;
}
