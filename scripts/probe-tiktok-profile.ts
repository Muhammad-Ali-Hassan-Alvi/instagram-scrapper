import { config } from "dotenv";

import {
  closeBrowserSession,
  createTikTokBrowserSession,
} from "../src/playwright/browser";
import { TIKTOK_BASE_URL } from "../src/playwright/constants";
import { dismissTikTokOverlays, ensureVideosTab } from "../src/playwright/tiktok-ui";

config({ path: ".env.local", override: true });

async function main(): Promise<void> {
  const username = process.argv[2]?.replace(/^@/, "") ?? "ball5show";
  const session = await createTikTokBrowserSession();

  try {
    await session.page.goto(`${TIKTOK_BASE_URL}/@${username}`, {
      waitUntil: "networkidle",
      timeout: 90000,
    });
    await session.page.waitForTimeout(5000);
    await dismissTikTokOverlays(session.page);
    await ensureVideosTab(session.page);

    for (let i = 0; i < 3; i++) {
      await session.page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await session.page.waitForTimeout(2500);
    }

    const stats = await session.page.evaluate(() => {
      const script = document.getElementById("__UNIVERSAL_DATA_FOR_REHYDRATION__")?.textContent;
      let itemModuleCount = 0;
      let itemListCount = 0;
      if (script) {
        try {
          const data = JSON.parse(script) as {
            __DEFAULT_SCOPE__?: { "webapp.user-detail"?: { itemModule?: object; itemList?: unknown[] } };
          };
          const detail = data.__DEFAULT_SCOPE__?.["webapp.user-detail"];
          itemModuleCount = Object.keys(detail?.itemModule ?? {}).length;
          itemListCount = detail?.itemList?.length ?? 0;
        } catch {
          // ignore
        }
      }

      return {
        url: location.href,
        postItems: document.querySelectorAll("div[data-e2e='user-post-item']").length,
        postList: document.querySelectorAll("[data-e2e='user-post-item-list']").length,
        userPage: document.querySelectorAll("[data-e2e='user-page']").length,
        videosTab: document.querySelectorAll("[data-e2e='videos-tab']").length,
        loginSentinel: document.querySelectorAll("[data-e2e='login-popup-row-sentinel']").length,
        bodyTextSample: document.body.innerText.slice(0, 500),
        itemModuleCount,
        itemListCount,
        title: document.title,
      };
    });

    console.log(JSON.stringify(stats, null, 2));
  } finally {
    await closeBrowserSession(session);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
