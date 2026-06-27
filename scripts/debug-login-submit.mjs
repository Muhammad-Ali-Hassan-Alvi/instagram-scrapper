import { mkdirSync } from "fs";
import { chromium } from "playwright";
import { config } from "dotenv";

config({ path: ".env.local", override: true });

const browser = await chromium.launch({ headless: true });
const page = await (await browser.newContext()).newPage();

await page.goto("https://www.instagram.com/accounts/login/", {
  waitUntil: "networkidle",
  timeout: 90000,
});
await page.waitForTimeout(2000);

const info = await page.evaluate(() => ({
  submitInputs: [...document.querySelectorAll('input[type="submit"]')].map((el) => ({
    value: el.value,
    hidden: el.offsetParent === null,
    display: getComputedStyle(el).display,
  })),
  roleButtons: [...document.querySelectorAll('[role="button"]')]
    .slice(0, 15)
    .map((el) => el.textContent?.trim()),
  divButtons: [...document.querySelectorAll("button, div")]
    .filter((el) => /log in/i.test(el.textContent ?? ""))
    .slice(0, 5)
    .map((el) => ({
      tag: el.tagName,
      text: el.textContent?.trim(),
    })),
}));

mkdirSync("scripts/.research-output", { recursive: true });
console.log(JSON.stringify(info, null, 2));
await browser.close();
