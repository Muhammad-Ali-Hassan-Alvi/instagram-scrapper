import type { Page } from "playwright";

import { getEnv } from "@/config/env";
import { logger } from "@/utils/logger";

import { INSTAGRAM_APP_ID } from "@/playwright/constants";
import { randomDelay } from "./parsers";
import type {
  FeedUserResponse,
  ScrapedPost,
  ScrapedProfile,
  WebProfileInfoResponse,
} from "./types";
import { parseFeedItem, parseWebProfilePost } from "./parsers";

interface BrowserFetchResult<T> {
  ok: boolean;
  status: number;
  data: T;
  raw: string;
}

export class InstagramClient {
  constructor(
    private readonly page: Page,
    private readonly minDelayMs: number,
    private readonly maxDelayMs: number,
  ) {}

  static fromPage(page: Page): InstagramClient {
    const { SCRAPE_MIN_DELAY_MS, SCRAPE_MAX_DELAY_MS } = getEnv();
    return new InstagramClient(page, SCRAPE_MIN_DELAY_MS, SCRAPE_MAX_DELAY_MS);
  }

  private async browserFetch<T>(url: string): Promise<BrowserFetchResult<T>> {
    await randomDelay(this.minDelayMs, this.maxDelayMs);

    return this.page.evaluate(
      async ({ fetchUrl, appId }) => {
        const csrf = document.cookie.match(/csrftoken=([^;]+)/)?.[1] ?? "";
        const response = await fetch(fetchUrl, {
          credentials: "include",
          headers: {
            "X-IG-App-ID": appId,
            "X-Requested-With": "XMLHttpRequest",
            ...(csrf ? { "X-CSRFToken": csrf } : {}),
          },
        });
        const raw = await response.text();
        let data: T;
        try {
          data = JSON.parse(raw) as T;
        } catch {
          data = {} as T;
        }
        return { ok: response.ok, status: response.status, data, raw };
      },
      { fetchUrl: url, appId: INSTAGRAM_APP_ID },
    );
  }

  async fetchProfile(username: string, category = ""): Promise<ScrapedProfile> {
    const url = `/api/v1/users/web_profile_info/?username=${encodeURIComponent(username)}`;
    const result = await this.browserFetch<WebProfileInfoResponse>(url);
    const user = result.data?.data?.user;

    if (!user?.id || !user.username) {
      throw new Error(
        `Failed to load profile for @${username} (HTTP ${result.status}): ${result.raw.slice(0, 200)}`,
      );
    }

    if (user.is_private) {
      throw new Error(`@${username} is private — cannot scrape public posts`);
    }

    return {
      platform: "instagram",
      accountId: user.id,
      username: user.username,
      displayName: user.full_name ?? "",
      biography: user.biography ?? "",
      profileImage: user.profile_pic_url_hd ?? user.profile_pic_url ?? "",
      followers: user.edge_followed_by?.count ?? 0,
      following: user.edge_follow?.count ?? 0,
      totalPosts: user.edge_owner_to_timeline_media?.count ?? 0,
      verified: user.is_verified ?? false,
      isPrivate: user.is_private ?? false,
      category,
    };
  }

  async fetchPostsFromWebProfile(
    username: string,
    profile: ScrapedProfile,
  ): Promise<ScrapedPost[]> {
    const url = `/api/v1/users/web_profile_info/?username=${encodeURIComponent(username)}`;
    const result = await this.browserFetch<WebProfileInfoResponse>(url);
    const edges = result.data?.data?.user?.edge_owner_to_timeline_media?.edges ?? [];

    const posts: ScrapedPost[] = [];
    for (const edge of edges) {
      if (!edge.node) continue;
      const parsed = parseWebProfilePost(edge.node, profile);
      if (parsed) posts.push(parsed);
    }
    return posts;
  }

  async fetchAllPostsViaFeed(
    profile: ScrapedProfile,
    loggedIn: boolean,
  ): Promise<{ posts: ScrapedPost[]; pagesScraped: number }> {
    if (!loggedIn) {
      logger.warn(
        `@${profile.username}: skipping feed pagination (login required for full history)`,
      );
      return { posts: [], pagesScraped: 0 };
    }

    // Warm profile context — feed/user pagination requires an authenticated browser session.
    await this.page.goto(`https://www.instagram.com/${profile.username}/`, {
      waitUntil: "domcontentloaded",
      timeout: 90000,
    });
    await this.page.waitForTimeout(1500);

    const postsByShortcode = new Map<string, ScrapedPost>();
    let maxId = "0";
    let pagesScraped = 0;
    let emptyStreak = 0;
    let rateLimitStreak = 0;
    const maxPages = Math.ceil(profile.totalPosts / 12) + 10;
    const maxRateLimitRetries = 8;

    while (pagesScraped < maxPages && emptyStreak < 3 && rateLimitStreak < maxRateLimitRetries) {
      const url = `/api/v1/feed/user/${profile.accountId}/?count=12&max_id=${encodeURIComponent(maxId)}`;
      const result = await this.browserFetch<FeedUserResponse>(url);
      const payload = result.data;

      if (payload?.require_login || payload?.message?.includes("login")) {
        const message = payload?.message ?? "";
        const rateLimited =
          message.toLowerCase().includes("wait") ||
          message.toLowerCase().includes("try again") ||
          message.toLowerCase().includes("limit");

        if (rateLimited) {
          rateLimitStreak++;
          logger.warn(
            `@${profile.username}: feed rate-limited (attempt ${rateLimitStreak}) — ${message || "retrying"}`,
          );
          await randomDelay(45000, 90000);
          continue;
        }

        logger.warn(`@${profile.username}: feed pagination requires login — ${message}`);
        break;
      }

      if (payload?.status === "fail") {
        rateLimitStreak++;
        logger.warn(
          `@${profile.username}: feed rate-limited (attempt ${rateLimitStreak}) — ${payload?.message ?? "retrying"}`,
        );
        await randomDelay(45000, 90000);
        continue;
      }

      rateLimitStreak = 0;
      const items = payload?.items ?? [];

      if (!items.length) {
        emptyStreak++;
        if (!payload?.more_available) break;
        await randomDelay(3000, 6000);
        continue;
      }

      emptyStreak = 0;
      pagesScraped++;

      for (const item of items) {
        const parsed = parseFeedItem(item, profile);
        if (parsed) postsByShortcode.set(parsed.shortcode, parsed);
      }

      logger.info(
        `@${profile.username}: page ${pagesScraped} — ${postsByShortcode.size}/${profile.totalPosts} posts`,
      );

      if (!payload?.more_available || !payload?.next_max_id) break;
      maxId = payload.next_max_id;

      if (postsByShortcode.size >= profile.totalPosts) break;
    }

    return { posts: [...postsByShortcode.values()], pagesScraped };
  }

  async scrapeAccount(
    username: string,
    category = "",
    loggedIn = false,
  ): Promise<{
    profile: ScrapedProfile;
    posts: ScrapedPost[];
    pagesScraped: number;
  }> {
    const profile = await this.fetchProfile(username, category);
    const firstPagePosts = await this.fetchPostsFromWebProfile(username, profile);

    const sessionActive =
      loggedIn ||
      (await this.page.context().cookies()).some(
        (cookie) => cookie.name === "sessionid" && cookie.value.length > 0,
      );

    const feedResult = await this.fetchAllPostsViaFeed(profile, sessionActive);

    const merged = new Map<string, ScrapedPost>();
    for (const post of firstPagePosts) merged.set(post.shortcode, post);
    for (const post of feedResult.posts) merged.set(post.shortcode, post);

    const posts = [...merged.values()].sort(
      (a, b) => b.postedAt.getTime() - a.postedAt.getTime(),
    );

    logger.info(
      `@${username}: ${posts.length}/${profile.totalPosts} posts collected (${feedResult.pagesScraped} feed pages)`,
    );

    return {
      profile,
      posts,
      pagesScraped: feedResult.pagesScraped + 1,
    };
  }
}
