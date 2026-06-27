import type { Page, Response } from "playwright";

import { PostType } from "@/models/Post";
import { TIKTOK_BASE_URL } from "@/playwright/constants";
import { dismissTikTokOverlays, ensureVideosTab, waitForProfileGrid } from "@/playwright/tiktok-ui";
import type { ScrapedPost, ScrapedProfile } from "@/scrapers/shared/types";
import { logger } from "@/utils/logger";

import {
  extractHashtags,
  extractMentions,
  parseTikTokItemListResponse,
  parseTikTokItemModule,
  parseTikTokProfileFromPage,
  parseTikTokViewCount,
} from "./parsers";
import type { TikTokItemListResponse, TikTokRehydratePayload, TikTokVideoItem } from "./types";

const SCROLL_SETTLE_MS = 2500;
const SCROLL_STAGNANT_LIMIT = 5;

interface GridPostDraft {
  videoUrl: string;
  postId: string;
  viewsText: string;
}

function buildPostUrl(username: string, videoId: string): string {
  return `${TIKTOK_BASE_URL}/@${username}/video/${videoId}`;
}

function normalizeVideoUrl(href: string): string {
  try {
    const url = new URL(href, TIKTOK_BASE_URL);
    return `${url.origin}${url.pathname}`;
  } catch {
    return href.split("?")[0] ?? href;
  }
}

function parseVideoItem(item: TikTokVideoItem, profile: ScrapedProfile): ScrapedPost | null {
  const postId = item.id;
  if (!postId) return null;

  const caption = item.desc ?? "";
  const mediaUrl = item.video?.playAddr ?? item.video?.downloadAddr ?? "";
  const thumbnailUrl = item.video?.cover ?? mediaUrl;
  const durationMs = item.video?.duration ?? null;

  return {
    platform: "tiktok",
    accountUsername: profile.username,
    accountId: profile.accountId,
    category: profile.category,
    postId: String(postId),
    shortcode: String(postId),
    postUrl: buildPostUrl(profile.username, String(postId)),
    type: PostType.Video,
    caption,
    hashtags: extractHashtags(caption),
    mentions: extractMentions(caption),
    mediaUrl,
    thumbnailUrl,
    postedAt: new Date((item.createTime ?? 0) * 1000),
    likes: item.stats?.diggCount ?? 0,
    comments: item.stats?.commentCount ?? 0,
    shares: item.stats?.shareCount ?? 0,
    saves: item.stats?.collectCount ?? 0,
    views: item.stats?.playCount ?? 0,
    duration: durationMs != null ? Math.round(durationMs / 1000) : null,
  };
}

function buildPostFromDraft(
  profile: ScrapedProfile,
  draft: GridPostDraft,
  moduleItem?: TikTokVideoItem,
): ScrapedPost {
  if (moduleItem) {
    const parsed = parseVideoItem({ ...moduleItem, id: moduleItem.id ?? draft.postId }, profile);
    if (parsed) {
      if (!parsed.views) {
        parsed.views = parseTikTokViewCount(draft.viewsText);
      }
      parsed.postUrl = draft.videoUrl;
      return parsed;
    }
  }

  return {
    platform: "tiktok",
    accountUsername: profile.username,
    accountId: profile.accountId,
    category: profile.category,
    postId: draft.postId,
    shortcode: draft.postId,
    postUrl: draft.videoUrl,
    type: PostType.Video,
    caption: "",
    hashtags: [],
    mentions: [],
    mediaUrl: "",
    thumbnailUrl: "",
    postedAt: new Date(0),
    likes: 0,
    comments: 0,
    shares: 0,
    saves: 0,
    views: parseTikTokViewCount(draft.viewsText),
    duration: null,
  };
}

async function readRehydrateScope(page: Page) {
  return page.evaluate(() => {
    const el = document.getElementById("__UNIVERSAL_DATA_FOR_REHYDRATION__");
    if (!el?.textContent) return null;
    try {
      return JSON.parse(el.textContent) as TikTokRehydratePayload;
    } catch {
      return null;
    }
  });
}

async function clickVideosTab(page: Page): Promise<void> {
  await ensureVideosTab(page);
}

async function collectGridPosts(page: Page): Promise<GridPostDraft[]> {
  const rows = await page.evaluate(() => {
    const items: GridPostDraft[] = [];

    for (const element of document.querySelectorAll("div[data-e2e='user-post-item']")) {
      const link = element.querySelector("a[href*='/video/']") as HTMLAnchorElement | null;
      if (!link?.href) continue;

      const match = link.href.match(/\/video\/(\d+)/);
      if (!match?.[1]) continue;

      const viewsEl = element.querySelector("strong[data-e2e='video-views']");
      items.push({
        videoUrl: link.href,
        postId: match[1],
        viewsText: viewsEl?.textContent?.trim() ?? "0",
      });
    }

    return items;
  });

  return rows.map((row) => ({
    ...row,
    videoUrl: normalizeVideoUrl(row.videoUrl),
  }));
}

async function scrollToPageBottom(page: Page): Promise<void> {
  await page.evaluate(() => {
    window.scrollTo(0, document.body.scrollHeight);
  });
}

async function fetchPostsViaItemListApi(
  page: Page,
  profile: ScrapedProfile,
  secUid: string,
  targetCount: number,
): Promise<{ posts: ScrapedPost[]; pages: number }> {
  const postsById = new Map<string, ScrapedPost>();
  let cursor = "0";
  let hasMore = true;
  let pages = 0;

  while (hasMore && pages < 100) {
    const params = new URLSearchParams({
      secUid,
      count: "35",
      cursor,
      coverFormat: "2",
      needPinnedItemIds: "1",
      post_item_list_request_type: "0",
    });
    const url = `${TIKTOK_BASE_URL}/api/post/item_list/?${params.toString()}`;
    const response = await page.request.get(url, {
      headers: {
        referer: `${TIKTOK_BASE_URL}/@${profile.username}`,
      },
    });

    if (!response.ok()) break;

    const data = (await response.json()) as TikTokItemListResponse;
    pages++;
    hasMore = Boolean(data.hasMore);
    if (data.cursor != null) cursor = String(data.cursor);

    for (const item of parseTikTokItemListResponse(data)) {
      const post = parseVideoItem(item, profile);
      if (post) postsById.set(post.postId, post);
    }

    if (targetCount > 0 && postsById.size >= targetCount) break;
    if ((data.itemList?.length ?? 0) === 0) break;
    await page.waitForTimeout(800);
  }

  return { posts: [...postsById.values()], pages };
}

export class TikTokClient {
  constructor(private readonly page: Page) {}

  static fromPage(page: Page): TikTokClient {
    return new TikTokClient(page);
  }

  async fetchProfile(username: string, category = ""): Promise<ScrapedProfile> {
    await this.page.goto(`${TIKTOK_BASE_URL}/@${username}`, {
      waitUntil: "networkidle",
      timeout: 90000,
    });
    await this.page.waitForSelector("#__UNIVERSAL_DATA_FOR_REHYDRATION__", {
      state: "attached",
      timeout: 30000,
    });
    await this.page
      .locator('[data-e2e="user-page"]')
      .waitFor({ state: "visible", timeout: 15000 })
      .catch(() => undefined);
    await this.page.waitForTimeout(5000);

    const payload = await readRehydrateScope(this.page);
    const scope = payload?.__DEFAULT_SCOPE__?.["webapp.user-detail"] ?? null;
    const parsed = parseTikTokProfileFromPage(scope, category);

    if (!parsed) {
      throw new Error(`Failed to load TikTok profile for @${username}`);
    }

    if (parsed.isPrivate) {
      throw new Error(`@${username} is private — cannot scrape public posts`);
    }

    return {
      platform: "tiktok",
      accountId: parsed.accountId,
      username: parsed.username,
      displayName: parsed.displayName,
      biography: parsed.biography,
      profileImage: parsed.profileImage,
      followers: parsed.followers,
      following: parsed.following,
      totalPosts: parsed.totalPosts,
      verified: parsed.verified,
      isPrivate: parsed.isPrivate,
      category,
    };
  }

  async scrapeAccount(
    username: string,
    category = "",
    loggedIn: boolean,
  ): Promise<{ profile: ScrapedProfile; posts: ScrapedPost[]; pagesScraped: number }> {
    const postsById = new Map<string, ScrapedPost>();
    const draftsByUrl = new Map<string, GridPostDraft>();
    let pagesScraped = 0;
    let currentProfile: ScrapedProfile | null = null;

    const onResponse = async (response: Response) => {
      if (!response.url().includes("/api/post/item_list")) return;

      const raw = await response.text().catch(() => "");
      if (raw.length < 20) return;

      try {
        const data = JSON.parse(raw) as TikTokItemListResponse;
        pagesScraped++;
        for (const item of parseTikTokItemListResponse(data)) {
          const profile = currentProfile;
          if (!profile) continue;
          const post = parseVideoItem(item, profile);
          if (post) postsById.set(post.postId, post);
        }
      } catch {
        // ignore malformed payloads
      }
    };

    this.page.on("response", onResponse);

    try {
      currentProfile = await this.fetchProfile(username, category);
      await dismissTikTokOverlays(this.page);
      await clickVideosTab(this.page);

      if (!loggedIn && currentProfile.totalPosts > 0) {
        logger.warn(
          `@${username}: TikTok may require login to load videos — run npm run tiktok:import-session or npm run tiktok:login`,
        );
      }

      const gridReady = await waitForProfileGrid(this.page, 30000);
      if (!gridReady) {
        logger.warn(`@${username}: video grid did not appear — continuing scroll anyway`);
      }

      let lastHeight = await this.page.evaluate(() => document.body.scrollHeight);
      let stagnantScrolls = 0;

      logger.info(`@${username}: scrolling profile grid to collect posts…`);

      while (true) {
        await dismissTikTokOverlays(this.page);

        const gridPosts = await collectGridPosts(this.page);
        for (const draft of gridPosts) {
          draftsByUrl.set(draft.videoUrl, draft);
        }

        logger.info(`@${username}: collected ${draftsByUrl.size} unique posts so far`);

        if (currentProfile.totalPosts > 0 && draftsByUrl.size >= currentProfile.totalPosts) {
          break;
        }

        await scrollToPageBottom(this.page);
        await this.page.waitForTimeout(SCROLL_SETTLE_MS);

        const newHeight = await this.page.evaluate(() => document.body.scrollHeight);
        if (newHeight === lastHeight) {
          stagnantScrolls++;
          if (stagnantScrolls >= SCROLL_STAGNANT_LIMIT) break;
        } else {
          stagnantScrolls = 0;
          lastHeight = newHeight;
        }
      }

      const payload = await readRehydrateScope(this.page);
      const userDetail = payload?.__DEFAULT_SCOPE__?.["webapp.user-detail"] ?? null;
      const itemModule = parseTikTokItemModule(userDetail);

      for (const draft of draftsByUrl.values()) {
        const moduleItem = itemModule[draft.postId];
        const post = buildPostFromDraft(currentProfile, draft, moduleItem);
        postsById.set(post.postId, post);
      }

      for (const item of userDetail?.itemList ?? []) {
        const post = parseVideoItem(item, currentProfile);
        if (post) postsById.set(post.postId, post);
      }

      for (const item of Object.values(itemModule)) {
        const post = parseVideoItem(item, currentProfile);
        if (post) postsById.set(post.postId, post);
      }

      const secUid = userDetail?.userInfo?.user?.secUid;
      if (secUid && postsById.size < currentProfile.totalPosts) {
        logger.info(`@${username}: fetching posts via item_list API fallback…`);
        const apiResult = await fetchPostsViaItemListApi(
          this.page,
          currentProfile,
          secUid,
          currentProfile.totalPosts,
        );
        pagesScraped += apiResult.pages;
        for (const post of apiResult.posts) {
          postsById.set(post.postId, post);
        }
      }

      const posts = [...postsById.values()].sort(
        (a, b) => b.postedAt.getTime() - a.postedAt.getTime(),
      );

      logger.info(
        `@${username}: finished with ${posts.length} posts (${draftsByUrl.size} from grid, ${pagesScraped} API pages)`,
      );

      return { profile: currentProfile, posts, pagesScraped };
    } finally {
      this.page.off("response", onResponse);
    }
  }
}
