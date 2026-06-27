/**
 * One-off research script — NOT production code.
 * Captures network requests when loading an Instagram profile.
 */
import { writeFileSync, mkdirSync } from "fs";
import { chromium } from "playwright";

const USERNAME = process.argv[2] ?? "instagram";
const OUT_DIR = "scripts/.research-output";

mkdirSync(OUT_DIR, { recursive: true });

const requests = [];
const responses = [];

function sanitizeHeaders(headers) {
  const out = { ...headers };
  for (const key of Object.keys(out)) {
    if (
      key.toLowerCase() === "cookie" ||
      key.toLowerCase() === "authorization"
    ) {
      out[key] = "[REDACTED]";
    }
  }
  return out;
}

function classifyUrl(url) {
  try {
    const u = new URL(url);
    return u.pathname + (u.search ? u.search.slice(0, 200) : "");
  } catch {
    return url.slice(0, 200);
  }
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  userAgent:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  viewport: { width: 1280, height: 900 },
  locale: "en-US",
});
const page = await context.newPage();

page.on("request", (req) => {
  const type = req.resourceType();
  if (!["xhr", "fetch", "document"].includes(type)) return;
  requests.push({
    url: req.url(),
    method: req.method(),
    resourceType: type,
    headers: sanitizeHeaders(req.headers()),
    postData: req.postData()?.slice(0, 4000) ?? null,
  });
});

page.on("response", async (res) => {
  const req = res.request();
  const type = req.resourceType();
  if (!["xhr", "fetch", "document"].includes(type)) return;

  const url = res.url();
  const contentType = res.headers()["content-type"] ?? "";
  let bodyPreview = null;
  let jsonKeys = null;
  let fieldSamples = null;

  if (contentType.includes("json") || contentType.includes("javascript")) {
    try {
      const text = await res.text();
      bodyPreview = text.slice(0, 8000);
      if (contentType.includes("json")) {
        const data = JSON.parse(text);
        jsonKeys = Object.keys(data);
        fieldSamples = extractFieldSamples(data);
      }
    } catch {
      bodyPreview = "[unreadable]";
    }
  }

  responses.push({
    url,
    status: res.status(),
    method: req.method(),
    resourceType: type,
    contentType,
    jsonKeys,
    fieldSamples,
    bodyPreview,
  });
});

function extractFieldSamples(data, depth = 0) {
  if (depth > 6 || data == null) return null;
  if (Array.isArray(data)) {
    return data.length > 0 ? extractFieldSamples(data[0], depth + 1) : [];
  }
  if (typeof data !== "object") return null;

  const keys = Object.keys(data);
  const interesting = [
    "username",
    "full_name",
    "biography",
    "follower_count",
    "following_count",
    "edge_followed_by",
    "edge_follow",
    "edge_owner_to_timeline_media",
    "media_count",
    "profile_pic_url",
    "profile_pic_url_hd",
    "is_verified",
    "is_private",
    "id",
    "pk",
    "shortcode",
    "like_count",
    "comment_count",
    "video_view_count",
    "play_count",
    "caption",
    "taken_at_timestamp",
    "display_url",
    "video_url",
    "page_info",
    "end_cursor",
    "next_max_id",
    "more_available",
    "doc_id",
    "data",
    "user",
    "items",
    "edges",
  ];

  const found = {};
  for (const k of keys) {
    if (interesting.includes(k)) {
      const v = data[k];
      if (typeof v === "object" && v !== null && !Array.isArray(v)) {
        found[k] = Object.keys(v).slice(0, 20);
      } else if (Array.isArray(v)) {
        found[k] = `array(${v.length})`;
      } else {
        found[k] = v;
      }
    }
  }

  if (found.data && typeof data.data === "object") {
    Object.assign(found, extractFieldSamples(data.data, depth + 1) ?? {});
  }
  if (found.user && typeof data.user === "object") {
    Object.assign(found, extractFieldSamples(data.user, depth + 1) ?? {});
  }

  return Object.keys(found).length ? found : null;
}

console.log(`Navigating to https://www.instagram.com/${USERNAME}/`);
await page.goto(`https://www.instagram.com/${USERNAME}/`, {
  waitUntil: "networkidle",
  timeout: 90000,
});

await page.waitForTimeout(3000);

console.log("Scrolling to trigger pagination...");
for (let i = 0; i < 5; i++) {
  await page.evaluate(() => window.scrollBy(0, window.innerHeight * 2));
  await page.waitForTimeout(2500);
}

await page.waitForTimeout(3000);

const summary = responses
  .filter((r) => r.contentType.includes("json") || r.url.includes("graphql"))
  .map((r) => ({
    status: r.status,
    method: r.method,
    path: classifyUrl(r.url),
    contentType: r.contentType,
    jsonKeys: r.jsonKeys,
    fieldSamples: r.fieldSamples,
  }));

writeFileSync(`${OUT_DIR}/requests.json`, JSON.stringify(requests, null, 2));
writeFileSync(`${OUT_DIR}/responses.json`, JSON.stringify(responses, null, 2));
writeFileSync(`${OUT_DIR}/summary.json`, JSON.stringify(summary, null, 2));

console.log(`Captured ${requests.length} requests, ${responses.length} responses`);
console.log(`JSON/API responses: ${summary.length}`);
for (const s of summary) {
  console.log(`${s.method} ${s.status} ${s.path}`);
  if (s.fieldSamples) console.log("  fields:", JSON.stringify(s.fieldSamples));
}

await browser.close();
