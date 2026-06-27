/**
 * Probe public profile API for target accounts.
 */
import { writeFileSync, mkdirSync } from "fs";
import { chromium } from "playwright";

const TARGETS = ["nicky.cass", "ball5show"];
const OUT = "scripts/.research-output";
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  userAgent:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  viewport: { width: 1280, height: 900 },
});
const page = await context.newPage();

const results = {};

for (const username of TARGETS) {
  const profile = {};
  const graphqlPosts = [];

  page.on("response", async (res) => {
    const url = res.url();
    try {
      if (url.includes("/api/v1/users/web_profile_info/")) {
        const json = await res.json();
        profile.webProfileInfo = {
          id: json?.data?.user?.id,
          username: json?.data?.user?.username,
          followers: json?.data?.user?.edge_followed_by?.count,
          posts: json?.data?.user?.edge_owner_to_timeline_media?.count,
          edges:
            json?.data?.user?.edge_owner_to_timeline_media?.edges?.length ?? 0,
          pageInfo: json?.data?.user?.edge_owner_to_timeline_media?.page_info,
          private: json?.data?.user?.is_private,
        };
      }
      if (
        url.includes("/graphql") ||
        url.includes("/api/graphql") ||
        url.includes("web_profile_info")
      ) {
        const ct = res.headers()["content-type"] ?? "";
        if (!ct.includes("json")) return;
        const text = await res.text();
        if (
          text.includes("edge_owner_to_timeline_media") ||
          text.includes("xdt_api__v1__feed__user") ||
          text.includes("shortcode")
        ) {
          graphqlPosts.push({
            url: url.slice(0, 120),
            friendly: res.request().headers()["x-fb-friendly-name"],
            snippet: text.slice(0, 500),
          });
        }
      }
    } catch {
      /* ignore parse errors */
    }
  });

  await page.goto(`https://www.instagram.com/${username}/`, {
    waitUntil: "networkidle",
    timeout: 90000,
  });
  await page.waitForTimeout(3000);

  for (let i = 0; i < 20; i++) {
    await page.mouse.wheel(0, 3000);
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(1200);
  }

  results[username] = { profile, graphqlHits: graphqlPosts.length, samples: graphqlPosts.slice(0, 3) };
  page.removeAllListeners("response");
}

writeFileSync(`${OUT}/target-probe.json`, JSON.stringify(results, null, 2));
console.log(JSON.stringify(results, null, 2));
await browser.close();
