import { chromium } from "playwright";

const USERNAME = "ball5show";
const browser = await chromium.launch({ headless: true });
const page = await (await browser.newContext()).newPage();
await page.goto(`https://www.instagram.com/${USERNAME}/`, { waitUntil: "networkidle", timeout: 90000 });
await page.waitForTimeout(2000);

const r = await page.evaluate(async (username) => {
  const csrf = document.cookie.match(/csrftoken=([^;]+)/)?.[1] ?? "";
  const headers = { "X-IG-App-ID": "936619743392459", "X-Requested-With": "XMLHttpRequest", ...(csrf ? { "X-CSRFToken": csrf } : {}) };
  const profile = await (await fetch(`/api/v1/users/web_profile_info/?username=${username}`, { headers, credentials: "include" })).json();
  const feed = await (await fetch(`/api/v1/feed/user/${profile.data.user.id}/?count=12&max_id=0`, { headers, credentials: "include" })).text();
  return {
    edges: profile?.data?.user?.edge_owner_to_timeline_media?.edges?.length,
    feedPreview: feed.slice(0, 200),
    feedLen: feed.length,
  };
}, USERNAME);
console.log(r);
await browser.close();
