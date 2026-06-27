import { chromium } from "playwright";

const username = process.argv[2] ?? "ball5show";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const itemLists = [];

  page.on("response", async (res) => {
    if (!res.url().includes("/api/post/item_list")) return;
    const text = await res.text().catch(() => "");
    itemLists.push({ status: res.status(), len: text.length, start: text.slice(0, 500) });
  });

  await page.goto(`https://www.tiktok.com/@${username}`, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForTimeout(3000);

  for (let i = 0; i < 8; i++) {
    await page.mouse.wheel(0, 2000);
    await page.waitForTimeout(2000);
  }

  const dom = await page.evaluate(() => {
    const links = [...document.querySelectorAll('a[href*="/video/"]')].map((a) => a.getAttribute("href"));
    return { videoLinks: [...new Set(links)].slice(0, 10) };
  });

  console.log(JSON.stringify({ itemLists, dom }, null, 2));
  await browser.close();
}

main().catch(console.error);
