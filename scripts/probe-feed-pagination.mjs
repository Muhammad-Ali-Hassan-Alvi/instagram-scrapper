/**
 * Paginate full profile via /api/v1/feed/user/{id}/ from browser context.
 */
import { writeFileSync, mkdirSync } from "fs";
import { chromium } from "playwright";

const USERNAME = process.argv[2] ?? "ball5show";
const MAX_PAGES = Number(process.argv[3] ?? 5);
const OUT = "scripts/.research-output";
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await (await browser.newContext({
  userAgent:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  viewport: { width: 1280, height: 900 },
})).newPage();

await page.goto(`https://www.instagram.com/${USERNAME}/`, {
  waitUntil: "networkidle",
  timeout: 90000,
});
await page.waitForTimeout(2000);

const result = await page.evaluate(
  async ({ username, maxPages }) => {
    const csrf = document.cookie.match(/csrftoken=([^;]+)/)?.[1] ?? "";
    const headers = {
      "X-IG-App-ID": "936619743392459",
      "X-Requested-With": "XMLHttpRequest",
      ...(csrf ? { "X-CSRFToken": csrf } : {}),
    };

    const profileRes = await fetch(
      `/api/v1/users/web_profile_info/?username=${encodeURIComponent(username)}`,
      { headers, credentials: "include" },
    );
    const profile = await profileRes.json();
    const user = profile?.data?.user;
    const userId = user?.id;

    const pages = [];
    let maxId = "0";
    let totalItems = 0;

    for (let pageNum = 0; pageNum < maxPages; pageNum++) {
      const res = await fetch(
        `/api/v1/feed/user/${userId}/?count=12&max_id=${maxId}`,
        { headers, credentials: "include" },
      );
      const json = await res.json();
      const items = json?.items ?? [];
      totalItems += items.length;

      const sample = items[0]
        ? {
            id: items[0].id ?? items[0].pk,
            code: items[0].code,
            like_count: items[0].like_count,
            comment_count: items[0].comment_count,
            play_count: items[0].play_count ?? items[0].view_count,
            media_type: items[0].media_type,
            product_type: items[0].product_type,
            repost_count: items[0].media_repost_count,
            taken_at: items[0].taken_at,
          }
        : null;

      pages.push({
        pageNum,
        maxIdUsed: maxId,
        numResults: json?.num_results,
        moreAvailable: json?.more_available,
        nextMaxId: json?.next_max_id,
        itemsLen: items.length,
        sample,
      });

      if (!json?.more_available || !items.length) break;

      const last = items[items.length - 1];
      maxId =
        json?.next_max_id ??
        last?.id ??
        `${last?.pk}_${userId}` ??
        "0";
    }

    return {
      userId,
      username: user?.username,
      totalPosts: user?.edge_owner_to_timeline_media?.count,
      followers: user?.edge_followed_by?.count,
      pagesFetched: pages.length,
      totalItems,
      pages,
    };
  },
  { username: USERNAME, maxPages: MAX_PAGES },
);

writeFileSync(`${OUT}/feed-pagination-${USERNAME}.json`, JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
await browser.close();
