import { PostType } from "@/models/Post";

import type { FeedItem, ScrapedPost, ScrapedProfile, WebProfilePostNode } from "./types";

const HASHTAG_RE = /#([\w\u0590-\u05ff\u0900-\u097f]+)/g;
const MENTION_RE = /@([\w.]+)/g;

export function randomDelay(minMs: number, maxMs: number): Promise<void> {
  const ms = minMs + Math.floor(Math.random() * (maxMs - minMs + 1));
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function extractHashtags(text: string): string[] {
  return [...text.matchAll(HASHTAG_RE)].map((m) => m[1].toLowerCase());
}

export function extractMentions(text: string): string[] {
  return [...text.matchAll(MENTION_RE)].map((m) => m[1].toLowerCase());
}

function resolvePostType(node: {
  __typename?: string;
  product_type?: string;
  is_video?: boolean;
  media_type?: number;
}): PostType {
  if (node.product_type === "clips") return PostType.Reel;
  if (node.__typename === "GraphSidecar") return PostType.Carousel;
  if (node.is_video || node.media_type === 2) return PostType.Video;
  return PostType.Image;
}

function buildPostUrl(shortcode: string, type: PostType): string {
  if (type === PostType.Reel) {
    return `https://www.instagram.com/reel/${shortcode}/`;
  }
  return `https://www.instagram.com/p/${shortcode}/`;
}

export function parseWebProfilePost(
  node: WebProfilePostNode,
  profile: ScrapedProfile,
): ScrapedPost | null {
  if (!node.id || !node.shortcode) return null;

  const caption = node.edge_media_to_caption?.edges?.[0]?.node?.text ?? "";
  const type = resolvePostType(node);

  return {
    platform: "instagram",
    accountUsername: profile.username,
    accountId: profile.accountId,
    category: profile.category,
    postId: node.id,
    shortcode: node.shortcode,
    postUrl: buildPostUrl(node.shortcode, type),
    type,
    caption,
    hashtags: extractHashtags(caption),
    mentions: extractMentions(caption),
    mediaUrl: node.display_url ?? "",
    thumbnailUrl: node.thumbnail_src ?? node.display_url ?? "",
    postedAt: new Date((node.taken_at_timestamp ?? 0) * 1000),
    likes: node.edge_liked_by?.count ?? 0,
    comments: node.edge_media_to_comment?.count ?? 0,
    shares: 0,
    saves: 0,
    views: node.video_view_count ?? 0,
    duration: node.video_duration ?? null,
  };
}

export function parseFeedItem(item: FeedItem, profile: ScrapedProfile): ScrapedPost | null {
  const shortcode = item.code;
  const postId = item.id ?? item.pk;
  if (!shortcode || !postId) return null;

  const caption = item.caption?.text ?? "";
  const type = resolvePostType(item);
  const mediaUrl =
    item.video_versions?.[0]?.url ??
    item.image_versions2?.candidates?.[0]?.url ??
    "";
  const thumbnailUrl = item.thumbnail_url ?? mediaUrl;

  return {
    platform: "instagram",
    accountUsername: profile.username,
    accountId: profile.accountId,
    category: profile.category,
    postId: String(postId),
    shortcode,
    postUrl: buildPostUrl(shortcode, type),
    type,
    caption,
    hashtags: extractHashtags(caption),
    mentions: extractMentions(caption),
    mediaUrl,
    thumbnailUrl,
    postedAt: new Date((item.taken_at ?? 0) * 1000),
    likes: item.like_count ?? 0,
    comments: item.comment_count ?? 0,
    shares: item.media_repost_count ?? 0,
    saves: 0,
    views: item.play_count ?? item.view_count ?? 0,
    duration: item.video_duration ?? null,
  };
}

export function getIsoWeek(date: Date): number {
  const target = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = target.getUTCDay() || 7;
  target.setUTCDate(target.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));
  return Math.ceil(((target.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}
