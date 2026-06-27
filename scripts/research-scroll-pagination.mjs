/**
 * Capture pagination requests by scrolling profile grid aggressively.
 */
import { writeFileSync, mkdirSync } from "fs";
import { chromium } from "playwright";

const OUT = "scripts/.research-output";
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await (await browser.newContext({
  userAgent:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  viewport: { width: 1280, height: 900 },
})).newPage();

const hits = [];

page.on("request", (req) => {
  const url = req.url();
  const body = req.postData() ?? "";
  if (
    body.includes("after") ||
    body.includes("end_cursor") ||
    url.includes("after") ||
    url.includes("max_id") ||
    url.includes("feed/user")
  ) {
    hits.push({
      method: req.method(),
      url,
      friendly: req.headers()["x-fb-friendly-name"],
      body: body.slice(0, 2000),
    });
  }
});

await page.goto("https://www.instagram.com/instagram/", {
  waitUntil: "networkidle",
  timeout: 90000,
});
await page.waitForTimeout(3000);

for (let i = 0; i < 15; i++) {
  await page.mouse.wheel(0, 2500);
  await page.waitForTimeout(1500);
  await page.evaluate(() => {
    const main = document.querySelector("main");
    if (main) main.scrollTop = main.scrollHeight;
  });
  await page.waitForTimeout(1000);
}

writeFileSync(`${OUT}/pagination-hits.json`, JSON.stringify(hits, null, 2));
console.log("pagination hits:", hits.length);
hits.forEach((h) =>
  console.log(h.method, h.friendly ?? "-", h.url.slice(0, 100)),
);
await browser.close();
