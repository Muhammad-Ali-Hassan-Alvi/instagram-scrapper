import type { TikTokItemListResponse, TikTokUserDetailScope } from "./types";

export {
  extractHashtags,
  extractMentions,
  getIsoWeek,
  randomDelay,
} from "@/scrapers/instagram/parsers";

export function parseTikTokProfileFromPage(scope: TikTokUserDetailScope | null): {
  accountId: string;
  username: string;
  displayName: string;
  biography: string;
  profileImage: string;
  followers: number;
  following: number;
  totalPosts: number;
  verified: boolean;
  isPrivate: boolean;
  secUid: string;
} | null {
  const userInfo = scope?.userInfo;
  const user = userInfo?.user;
  if (!user?.id || !user.uniqueId) return null;

  return {
    accountId: String(user.id),
    username: user.uniqueId,
    displayName: user.nickname ?? user.uniqueId,
    biography: user.signature ?? "",
    profileImage: user.avatarLarger ?? user.avatarMedium ?? "",
    followers: userInfo?.stats?.followerCount ?? 0,
    following: userInfo?.stats?.followingCount ?? 0,
    totalPosts: userInfo?.stats?.videoCount ?? 0,
    verified: user.verified ?? false,
    isPrivate: user.privateAccount ?? false,
    secUid: user.secUid ?? "",
  };
}

export function parseTikTokItemListResponse(
  data: TikTokItemListResponse,
): Array<NonNullable<TikTokItemListResponse["itemList"]>[number]> {
  return data.itemList ?? [];
}

export function parseTikTokViewCount(text: string): number {
  const cleaned = text.trim().replace(/,/g, "");
  if (!cleaned) return 0;

  const match = cleaned.match(/^([\d.]+)\s*([KMB])?$/i);
  if (!match) return 0;

  const num = Number.parseFloat(match[1]);
  if (Number.isNaN(num)) return 0;

  const suffix = (match[2] ?? "").toUpperCase();
  if (suffix === "K") return Math.round(num * 1_000);
  if (suffix === "M") return Math.round(num * 1_000_000);
  if (suffix === "B") return Math.round(num * 1_000_000_000);
  return Math.round(num);
}

export function parseTikTokItemModule(
  scope: TikTokUserDetailScope | null | undefined,
): Record<string, NonNullable<TikTokUserDetailScope["itemModule"]>[string]> {
  return scope?.itemModule ?? {};
}
