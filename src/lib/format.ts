export function formatNumber(value: number): string {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(1).replace(/\.0$/, "")}K`;
  }
  return value.toLocaleString();
}

export function formatDate(value: Date | string | null | undefined): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function formatDateTime(value: Date | string | null | undefined): string {
  if (!value) return "—";
  return new Date(value).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function instagramPostUrl(shortcode: string, type: string): string {
  if (!shortcode) return "";
  if (type === "reel") return `https://www.instagram.com/reel/${shortcode}/`;
  return `https://www.instagram.com/p/${shortcode}/`;
}

export function tiktokPostUrl(username: string, videoId: string): string {
  if (!videoId) return "";
  const handle = username.replace(/^@/, "");
  return `https://www.tiktok.com/@${handle}/video/${videoId}`;
}

export function postUrlForPlatform(
  platform: string,
  username: string,
  shortcode: string,
  type: string,
): string {
  if (platform === "tiktok") return tiktokPostUrl(username, shortcode);
  return instagramPostUrl(shortcode, type);
}
