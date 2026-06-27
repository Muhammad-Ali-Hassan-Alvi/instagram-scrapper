/**
 * Test post pagination inside browser context using observed end_cursor.
 */
import { readFileSync, writeFileSync } from "fs";
import { chromium } from "playwright";

const profile = JSON.parse(
  readFileSync(
    "scripts/.research-output/full-1-_api_v1_users_web_profile_info_username_instagram.txt",
    "utf8",
  ),
);

const userId = profile.data.user.id;
const endCursor =
  profile.data.user.edge_owner_to_timeline_media.page_info.end_cursor;

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  userAgent:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  locale: "en-US",
});
const page = await context.newPage();
await page.goto("https://www.instagram.com/instagram/", {
  waitUntil: "networkidle",
  timeout: 90000,
});

const cookies = await context.cookies();
const csrf = cookies.find((c) => c.name === "csrftoken")?.value;

const attempts = [];

async function tryFetch(label, url, method = "GET", body = null) {
  const result = await page.evaluate(
    async ({ url, method, body, csrf }) => {
      const headers = {
        "X-IG-App-ID": "936619743392459",
        "X-Requested-With": "XMLHttpRequest",
        Accept: "*/*",
        Referer: "https://www.instagram.com/instagram/",
      };
      if (csrf) headers["X-CSRFToken"] = csrf;
      const res = await fetch(url, {
        method,
        headers,
        body,
        credentials: "include",
      });
      const text = await res.text();
      return { status: res.status, text: text.slice(0, 3000) };
    },
    { url, method, body, csrf },
  );
  attempts.push({ label, url: url.slice(0, 160), ...result });
  console.log(label, result.status, result.text.slice(0, 120));
}

// Observed legacy query_id pattern (may be deprecated)
const legacyVars = encodeURIComponent(
  JSON.stringify({ id: userId, first: 12, after: endCursor }),
);
await tryFetch(
  "legacy query_id 17830106458427912",
  `https://www.instagram.com/graphql/query/?query_id=17830106458427912&variables=${legacyVars}`,
);

// doc_id from PolarisProfilePageContentQuery first capture
const postVars = {
  id: userId,
  first: 12,
  after: endCursor,
};
const form = new URLSearchParams();
form.set("variables", JSON.stringify(postVars));
form.set("doc_id", "26672929172408668");

await tryFetch(
  "POST /api/graphql doc_id 26672929172408668 minimal",
  "https://www.instagram.com/api/graphql",
  "POST",
  form.toString(),
);

writeFileSync(
  "scripts/.research-output/pagination-attempts.json",
  JSON.stringify({ userId, endCursor, csrf: !!csrf, attempts }, null, 2),
);

await browser.close();
