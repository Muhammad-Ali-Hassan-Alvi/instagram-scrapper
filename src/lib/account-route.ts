import { DEFAULT_TARGET_ACCOUNTS, type TargetAccount } from "@/config/accounts";

export function accountKey(platform: string, username: string): string {
  return `${platform}:${username.toLowerCase()}`;
}

export function parseAccountKey(key: string): { platform: string; username: string } | null {
  const separator = key.indexOf(":");
  if (separator <= 0) return null;

  return {
    platform: key.slice(0, separator),
    username: key.slice(separator + 1).toLowerCase(),
  };
}

export function platformLabel(platform: string): string {
  if (platform === "tiktok") return "TikTok";
  if (platform === "instagram") return "Instagram";
  return platform;
}

export function accountLabel(platform: string, username: string): string {
  return `${platformLabel(platform)} · @${username}`;
}

export function accountPath(platform: string, username: string): string {
  const params = new URLSearchParams({ platform });
  return `/accounts/${username}?${params.toString()}`;
}

export function profileUrl(platform: string, username: string): string {
  if (platform === "tiktok") return `https://www.tiktok.com/@${username}`;
  return `https://www.instagram.com/${username}/`;
}

export function findTargetAccount(
  platform: string,
  username: string,
): TargetAccount | undefined {
  return DEFAULT_TARGET_ACCOUNTS.find(
    (account) =>
      account.platform === platform && account.username.toLowerCase() === username.toLowerCase(),
  );
}

export function isTargetAccount(platform: string, username: string): boolean {
  return findTargetAccount(platform, username) != null;
}
