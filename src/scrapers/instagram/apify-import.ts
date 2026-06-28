import { PostType } from "@/models/Post";
import { extractHashtags, extractMentions } from "@/scrapers/instagram/parsers";
import type { ScrapedPost, ScrapedProfile } from "@/scrapers/shared/types";

export interface ApifyInstagramItem {
  id?: string;
  shortCode?: string;
  url?: string;
  caption?: string;
  likesCount?: number;
  commentsCount?: number;
  videoViewCount?: number;
  videoPlayCount?: number;
  timestamp?: string;
  displayUrl?: string;
  videoUrl?: string;
  type?: string;
  ownerUsername?: string;
  ownerId?: string;
  owner?: {
    username?: string;
    id?: string;
    fullName?: string;
    profilePicUrl?: string;
    followersCount?: number;
    followsCount?: number;
    postsCount?: number;
    isVerified?: boolean;
    isPrivate?: boolean;
    biography?: string;
  };
}

function readUsername(item: ApifyInstagramItem, fallback?: string): string {
  return (
    item.ownerUsername?.trim().toLowerCase() ||
    item.owner?.username?.trim().toLowerCase() ||
    fallback?.trim().toLowerCase() ||
    ""
  );
}

function readShortCode(item: ApifyInstagramItem): string | null {
  if (item.shortCode?.trim()) return item.shortCode.trim();
  if (item.url) {
    const match = item.url.match(/\/(?:p|reel|tv)\/([^/?#]+)/);
    if (match?.[1]) return match[1];
  }
  return null;
}

function mapPostType(type: string | undefined): PostType {
  const normalized = (type ?? "").toLowerCase();
  if (normalized.includes("video") || normalized.includes("reel")) return PostType.Reel;
  if (normalized.includes("sidecar") || normalized.includes("carousel")) return PostType.Carousel;
  return PostType.Image;
}

export function filterApifyInstagramItemsForAccount(
  items: ApifyInstagramItem[],
  username: string,
): ApifyInstagramItem[] {
  const target = username.toLowerCase();
  return items.filter((item) => readUsername(item) === target);
}

export function dedupeApifyInstagramItems(items: ApifyInstagramItem[]): ApifyInstagramItem[] {
  const byKey = new Map<string, ApifyInstagramItem>();

  for (const item of items) {
    const key = readShortCode(item) || item.id;
    if (!key) continue;

    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, item);
      continue;
    }

    const existingTime = Date.parse(existing.timestamp ?? "");
    const nextTime = Date.parse(item.timestamp ?? "");
    if (nextTime >= existingTime) {
      byKey.set(key, item);
    }
  }

  return [...byKey.values()];
}

export function mapApifyInstagramItemToScrapedPost(
  item: ApifyInstagramItem,
  category: string,
  accountUsername?: string,
): ScrapedPost | null {
  const username = readUsername(item, accountUsername);
  const shortcode = readShortCode(item);
  if (!username || !shortcode) return null;

  const postedAt = item.timestamp ? new Date(item.timestamp) : new Date(0);
  if (Number.isNaN(postedAt.getTime())) return null;

  const caption = item.caption ?? "";
  const postUrl =
    item.url ?? `https://www.instagram.com/p/${shortcode}/`;

  return {
    platform: "instagram",
    accountUsername: username,
    accountId: item.ownerId ?? item.owner?.id ?? username,
    category,
    postId: item.id ?? shortcode,
    shortcode,
    postUrl,
    type: mapPostType(item.type),
    caption,
    hashtags: extractHashtags(caption),
    mentions: extractMentions(caption),
    mediaUrl: item.videoUrl ?? item.displayUrl ?? "",
    thumbnailUrl: item.displayUrl ?? "",
    postedAt,
    likes: item.likesCount ?? 0,
    comments: item.commentsCount ?? 0,
    shares: 0,
    saves: 0,
    views: item.videoViewCount ?? item.videoPlayCount ?? 0,
    duration: null,
  };
}

export function buildApifyInstagramProfile(
  username: string,
  items: ApifyInstagramItem[],
  category: string,
): ScrapedProfile {
  const sample =
    items.find((item) => readUsername(item) === username.toLowerCase()) ?? items[0];
  const owner = sample?.owner;

  return {
    platform: "instagram",
    accountId: owner?.id ?? sample?.ownerId ?? username,
    username,
    displayName: owner?.fullName ?? username,
    biography: owner?.biography ?? "",
    profileImage: owner?.profilePicUrl ?? sample?.displayUrl ?? "",
    followers: owner?.followersCount ?? 0,
    following: owner?.followsCount ?? 0,
    totalPosts: owner?.postsCount ?? items.length,
    verified: owner?.isVerified ?? false,
    isPrivate: owner?.isPrivate ?? false,
    category,
  };
}
