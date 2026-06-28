import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

import { DEFAULT_TARGET_ACCOUNTS } from "@/config/accounts";
import { logger } from "@/utils/logger";

function pythonCommand(): string {
  try {
    execSync("python --version", { stdio: "ignore" });
    return "python";
  } catch {
    return "py -3";
  }
}

function ensureSetup(): void {
  const vendorDir = resolve("vendor/tiktok-content-scraper");
  if (!existsSync(vendorDir)) {
    logger.error("TikTok-Content-Scraper not installed. Run: npm run tiktok:ttcs:setup");
    process.exit(1);
  }
}

async function main(): Promise<void> {
  ensureSetup();

  const usernames = process.argv.slice(2);
  const targets =
    usernames.length > 0
      ? usernames.map((username) => username.replace(/^@/, ""))
      : DEFAULT_TARGET_ACCOUNTS.filter((account) => account.platform === "tiktok").map(
          (account) => account.username,
        );

  logger.info(
    `TTCS TikTok scrape for: ${targets.map((username) => `@${username}`).join(", ")}`,
  );

  logger.info("Step 1/3 — Discover video IDs with Playwright (uses saved TikTok session)…");
  execSync(
    `npx tsx --tsconfig tsconfig.json scripts/tiktok-content-scraper/discover-videos.ts ${targets.join(" ")}`,
    { stdio: "inherit", cwd: process.cwd() },
  );

  logger.info("Step 2/3 — Scrape per-video metadata with TikTok-Content-Scraper…");
  const python = pythonCommand();
  const scriptPath = resolve("scripts/tiktok-content-scraper/run_targets.py");
  execSync(`${python} "${scriptPath}"`, {
    stdio: "inherit",
    cwd: process.cwd(),
  });

  logger.info("Step 3/3 — Import TTCS JSON into MongoDB…");
  execSync(`npm run tiktok:import-ttcs -- ${targets.join(" ")}`, {
    stdio: "inherit",
    cwd: process.cwd(),
  });
}

main().catch((error) => {
  logger.error("TTCS TikTok scrape failed", error);
  process.exit(1);
});
