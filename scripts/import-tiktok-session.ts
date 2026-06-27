import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";

import { config } from "dotenv";

import { TIKTOK_SESSION_PATH } from "../src/playwright/constants";
import {
  buildPlaywrightStorageState,
  hasTikTokAuthCookies,
  type TikTokBrowserExport,
} from "../src/playwright/tiktok-session";
import { logger } from "../src/utils/logger";

config({ path: ".env.local", override: true });

const AUTH_DIR = dirname(TIKTOK_SESSION_PATH);
const EXPORT_PATH = join(AUTH_DIR, "tiktok-browser-export.json");
const EXTRAS_PATH = join(AUTH_DIR, "tiktok-session-extras.json");

function main(): void {
  if (!existsSync(EXPORT_PATH)) {
    logger.error(
      `Missing ${EXPORT_PATH}. Paste DevTools cookies/localStorage/sessionStorage into that file.`,
    );
    process.exit(1);
  }

  const exportData = JSON.parse(readFileSync(EXPORT_PATH, "utf8")) as TikTokBrowserExport;
  const storageState = buildPlaywrightStorageState(exportData);

  if (!hasTikTokAuthCookies(storageState.cookies)) {
    logger.error("Export does not contain TikTok auth cookies (uid_tt, sessionid, sid_tt, or ssid_ucp_v1).");
    process.exit(1);
  }

  if (!existsSync(AUTH_DIR)) {
    mkdirSync(AUTH_DIR, { recursive: true });
  }

  writeFileSync(TIKTOK_SESSION_PATH, `${JSON.stringify(storageState, null, 2)}\n`, "utf8");

  if (exportData.sessionStorage && Object.keys(exportData.sessionStorage).length > 0) {
    writeFileSync(
      EXTRAS_PATH,
      `${JSON.stringify({ sessionStorage: exportData.sessionStorage }, null, 2)}\n`,
      "utf8",
    );
  }

  logger.info(`Imported TikTok session to ${TIKTOK_SESSION_PATH}`);
  logger.info(`Cookies: ${storageState.cookies.length}, localStorage keys: ${storageState.origins[0]?.localStorage.length ?? 0}`);
  if (exportData.sessionStorage) {
    logger.info(`SessionStorage keys saved to ${EXTRAS_PATH}`);
  }
}

main();
