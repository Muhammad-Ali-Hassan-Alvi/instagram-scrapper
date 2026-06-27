import { config } from "dotenv";
import { chromium } from "playwright";

config({ path: ".env.local", override: true });

const target = process.argv[2] ?? "ball5show";
const email = process.env.TIKTOK_USERNAME;
const password = process.env.TIKTOK_PASSWORD;

async function clickIfVisible(page, locator) {
  if (await locator.isVisible({ timeout: 2000 }).catch(() => false)) {
    await locator.click();
    await page.waitForTimeout(800);
    return true;
  }
  return false;
}

async function main() {
  const browser = await chromium.launch({ headless: false, slowMo: 50 });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const itemLists = [];

  page.on("response", async (res) => {
    if (!res.url().includes("/api/post/item_list")) return;
    const text = await res.text().catch(() => "");
    if (text.length > 100) {
      const json = JSON.parse(text);
      itemLists.push({ itemCount: json.itemList?.length ?? 0, hasMore: json.hasMore });
    }
  });

  await page.goto("https://www.tiktok.com/", { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForTimeout(2000);

  await clickIfVisible(page, page.getByRole("button", { name: /accept all|allow all|agree/i }));
  await clickIfVisible(page, page.locator('button:has-text("Accept")'));

  await clickIfVisible(page, page.getByRole("link", { name: /log in/i }));
  await page.waitForTimeout(1500);

  await clickIfVisible(page, page.getByText(/use phone \/ email \/ username|log in with email/i));
  await clickIfVisible(page, page.getByText(/log in with email or username/i));
  await page.waitForTimeout(1000);

  const emailField = page.locator('input[name="username"], input[placeholder*="Email"], input[type="text"]').first();
  await emailField.waitFor({ state: "visible", timeout: 15000 });
  await emailField.fill(email);
  await page.locator('input[type="password"]').first().fill(password);

  await clickIfVisible(page, page.locator('button[type="submit"]'));
  await clickIfVisible(page, page.getByRole("button", { name: /^log in$/i }));

  console.log("waiting for login...");
  await page.waitForTimeout(20000);
  console.log("url:", page.url());

  const cookies = await page.context().cookies("https://www.tiktok.com");
  console.log(
    "cookies:",
    cookies.map((c) => `${c.name}=${c.value.slice(0, 8)}`),
  );

  await page.goto(`https://www.tiktok.com/@${target}`, { waitUntil: "networkidle", timeout: 120000 });
  await page.waitForTimeout(4000);

  for (let i = 0; i < 6; i++) {
    await page.mouse.wheel(0, 2500);
    await page.waitForTimeout(2500);
  }

  const links = await page.locator('a[href*="/video/"]').count();
  console.log(JSON.stringify({ itemLists, videoLinkCount: links }, null, 2));

  await page.context().storageState({ path: ".auth/tiktok-session-probe.json" });
  await browser.close();
}

main().catch(console.error);
