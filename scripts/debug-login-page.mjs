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
await page.waitForTimeout(3000);

mkdirSync("scripts/.research-output", { recursive: true });
await page.screenshot({ path: "scripts/.research-output/login-page.png", fullPage: true });

const info = await page.evaluate(() => ({
  url: location.href,
  title: document.title,
  inputs: [...document.querySelectorAll("input")].map((el) => ({
    name: el.getAttribute("name"),
    type: el.getAttribute("type"),
    aria: el.getAttribute("aria-label"),
    autocomplete: el.getAttribute("autocomplete"),
  })),
  buttons: [...document.querySelectorAll("button")].slice(0, 10).map((el) => el.textContent?.trim()),
}));

console.log(JSON.stringify(info, null, 2));
await browser.close();
