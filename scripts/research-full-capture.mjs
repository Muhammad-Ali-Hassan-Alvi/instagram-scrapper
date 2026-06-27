/**
 * One-off research — saves full JSON for key endpoints only.
 */
import { writeFileSync, mkdirSync } from "fs";
import { chromium } from "playwright";

const USERNAME = "instagram";
const OUT = "scripts/.research-output";
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  userAgent:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  viewport: { width: 1280, height: 900 },
  locale: "en-US",
});
const page = await context.newPage();

const saved = [];

page.on("response", async (res) => {
  const url = res.url();
  const save =
    url.includes("web_profile_info") ||
    (url.includes("/api/graphql") &&
      res.request().postData()?.includes("PolarisProfilePageContentQuery")) ||
    url.includes("/graphql/query") ||
    url.includes("/feed/user/");

  if (!save) return;
  try {
    const text = await res.text();
    const name = url
      .replace(/https:\/\/www\.instagram\.com/, "")
      .replace(/[^\w.-]+/g, "_")
      .slice(0, 80);
    const file = `${OUT}/full-${saved.length}-${name}.txt`;
    writeFileSync(file, text);
    saved.push({ url, status: res.status(), file, len: text.length });
  } catch {
    /* ignore */
  }
});

await page.goto(`https://www.instagram.com/${USERNAME}/`, {
  waitUntil: "networkidle",
  timeout: 90000,
});
await page.waitForTimeout(2000);

for (let i = 0; i < 8; i++) {
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(2000);
}

await page.waitForTimeout(2000);
writeFileSync(`${OUT}/full-manifest.json`, JSON.stringify(saved, null, 2));
console.log(JSON.stringify(saved, null, 2));
await browser.close();
