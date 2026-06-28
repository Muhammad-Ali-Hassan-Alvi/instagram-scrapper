export const DEFAULT_APIFY_TIKTOK_ACTOR = "clockworks/tiktok-scraper";
export const DEFAULT_APIFY_INSTAGRAM_ACTOR = "apify/instagram-scraper";

export function getApifyTikTokActorId(): string {
  return process.env.APIFY_TIKTOK_ACTOR?.trim() || DEFAULT_APIFY_TIKTOK_ACTOR;
}

export function getApifyInstagramActorId(): string {
  return process.env.APIFY_INSTAGRAM_ACTOR?.trim() || DEFAULT_APIFY_INSTAGRAM_ACTOR;
}

export function getEnvApifyToken(): string | null {
  const token = process.env.APIFY_TOKEN?.trim();
  return token || null;
}
