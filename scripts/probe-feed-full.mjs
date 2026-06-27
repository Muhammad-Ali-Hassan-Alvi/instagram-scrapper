/**
 * Full pagination test with retries and delays.
 */
import { writeFileSync, mkdirSync } from "fs";
import { chromium } from "playwright";

const USERNAME = process.argv[2] ?? "ball5show";
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

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const result = await page.evaluate(async (username) => {
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
  const userId = profile?.data?.user?.id;
  const expected = profile?.data?.user?.edge_owner_to_timeline_media?.count ?? 0;

  const allCodes = new Set();
  let maxId = "0";
  let emptyStreak = 0;
  let pageNum = 0;

  while (pageNum < 100 && emptyStreak < 3) {
    const res = await fetch(
      `/api/v1/feed/user/${userId}/?count=12&max_id=${maxId}`,
      { headers, credentials: "include" },
    );
    const json = await res.json();
    const items = json?.items ?? [];

    if (!items.length) {
      emptyStreak++;
    } else {
      emptyStreak = 0;
      for (const item of items) {
        if (item.code) allCodes.add(item.code);
      }
    }

    if (!json?.more_available) break;
    if (!json?.next_max_id) break;
    maxId = json.next_max_id;
    pageNum++;
    await new Promise((r) => setTimeout(r, 800));
  }

  return {
    expected,
    fetched: allCodes.size,
    pages: pageNum + 1,
    sampleCodes: [...allCodes].slice(0, 5),
  };
}, USERNAME);

writeFileSync(`${OUT}/feed-full-${USERNAME}.json`, JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
await browser.close();
