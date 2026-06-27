/**
 * Test pagination strategies from browser context after web_profile_info.
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
await page.waitForTimeout(3000);

const bootstrap = await page.evaluate(async (username) => {
  const csrf =
    document.cookie.match(/csrftoken=([^;]+)/)?.[1] ??
    document.cookie.match(/csrf=([^;]+)/)?.[1] ??
    "";

  const profileRes = await fetch(
    `/api/v1/users/web_profile_info/?username=${encodeURIComponent(username)}`,
    {
      headers: {
        "X-IG-App-ID": "936619743392459",
        "X-Requested-With": "XMLHttpRequest",
        ...(csrf ? { "X-CSRFToken": csrf } : {}),
      },
      credentials: "include",
    },
  );
  const profile = await profileRes.json();
  const user = profile?.data?.user;
  const pageInfo = user?.edge_owner_to_timeline_media?.page_info;
  const userId = user?.id;
  const endCursor = pageInfo?.end_cursor;

  const attempts = [];

  async function tryFetch(label, url, init = {}) {
    try {
      const res = await fetch(url, {
        credentials: "include",
        ...init,
        headers: {
          "X-IG-App-ID": "936619743392459",
          "X-Requested-With": "XMLHttpRequest",
          ...(csrf ? { "X-CSRFToken": csrf } : {}),
          ...(init.headers ?? {}),
        },
      });
      const ct = res.headers.get("content-type") ?? "";
      const text = await res.text();
      attempts.push({
        label,
        status: res.status,
        ct,
        ok: res.ok,
        len: text.length,
        preview: text.slice(0, 300),
        hasEdges: text.includes("edge_owner_to_timeline_media") || text.includes("shortcode"),
      });
    } catch (e) {
      attempts.push({ label, error: String(e) });
    }
  }

  // REST feed user (mobile-style)
  await tryFetch(
    "feed/user max_id=0",
    `/api/v1/feed/user/${userId}/?count=12&max_id=0`,
  );

  if (endCursor) {
    const vars = encodeURIComponent(
      JSON.stringify({
        id: userId,
        first: 12,
        after: endCursor,
      }),
    );

    await tryFetch(
      "graphql query_id legacy",
      `/graphql/query/?query_id=17830106458427912&variables=${vars}`,
    );

    await tryFetch(
      "graphql doc_id profile posts",
      `/graphql/query/?doc_id=2690916830406212&variables=${vars}`,
    );

    await tryFetch(
      "graphql doc_id alt",
      `/graphql/query/?doc_id=7952363535924721&variables=${vars}`,
    );
  }

  return {
    userId,
    endCursor,
    firstPageEdges: user?.edge_owner_to_timeline_media?.edges?.length ?? 0,
    attempts,
  };
}, USERNAME);

writeFileSync(`${OUT}/pagination-probe-${USERNAME}.json`, JSON.stringify(bootstrap, null, 2));
console.log(JSON.stringify(bootstrap, null, 2));
await browser.close();
