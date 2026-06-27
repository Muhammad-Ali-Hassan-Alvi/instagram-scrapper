import { chromium } from "playwright";
import { writeFileSync } from "fs";

const username = process.argv[2] ?? "nicky.cass";

async function main() {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  const hits = [];

  page.on("response", async (res) => {
    const url = res.url();
    if (url.includes("/api/")) {
      const ct = res.headers()["content-type"] ?? "";
      let body = null;
      try {
        body = await res.text();
      } catch {}
      hits.push({
        url: url.split("?")[0],
        status: res.status(),
        ct,
        bodyLen: body?.length ?? 0,
        bodyStart: body?.slice(0, 200),
      });
    }
  });

  await page.goto(`https://www.tiktok.com/@${username}`, {
    waitUntil: "networkidle",
    timeout: 120000,
  });
  await page.waitForTimeout(5000);

  const parsed = await page.evaluate(() => {
    const el = document.getElementById("__UNIVERSAL_DATA_FOR_REHYDRATION__");
    if (!el?.textContent) return { error: "no rehydrate" };
    const data = JSON.parse(el.textContent);
    const scope = data.__DEFAULT_SCOPE__ ?? {};
    const userDetail = scope["webapp.user-detail"]?.userInfo;
    const itemList = scope["webapp.user-detail"]?.itemList;
    return {
      scopeKeys: Object.keys(scope),
      userInfo: userDetail
        ? {
            uniqueId: userDetail.user?.uniqueId,
            secUid: userDetail.user?.secUid,
            id: userDetail.user?.id,
            followerCount: userDetail.stats?.followerCount,
            videoCount: userDetail.stats?.videoCount,
          }
        : null,
      itemListLen: itemList?.length ?? 0,
      firstItem: itemList?.[0]
        ? {
            id: itemList[0].id,
            desc: itemList[0].desc?.slice(0, 80),
            stats: itemList[0].stats,
          }
        : null,
    };
  });

  writeFileSync("probe-tiktok-out.json", JSON.stringify({ parsed, hits: hits.slice(0, 30) }, null, 2));
  console.log(JSON.stringify(parsed, null, 2));
  console.log("api hits:", hits.length);
  await browser.close();
}

main().catch(console.error);
