import type { Page } from "playwright";

async function clickIfVisible(page: Page, selector: string): Promise<boolean> {
  const button = page.locator(selector).first();
  if (await button.isVisible({ timeout: 1500 }).catch(() => false)) {
    await button.click().catch(() => undefined);
    await page.waitForTimeout(800);
    return true;
  }
  return false;
}

export async function dismissTikTokOverlays(page: Page): Promise<void> {
  const selectors = [
    'button:has-text("Accept all")',
    'button:has-text("Allow all")',
    'button:has-text("Decline optional cookies")',
    'button:has-text("Got it")',
    'button:has-text("Skip")',
    'button:has-text("Not now")',
    'button:has-text("Not Now")',
    '[data-e2e="modal-close-inner-button"]',
    '.TUXModal-overlay button[aria-label="Close"]',
  ];

  for (let attempt = 0; attempt < 6; attempt++) {
    let clicked = false;
    for (const selector of selectors) {
      if (await clickIfVisible(page, selector)) {
        clicked = true;
      }
    }

    const openOverlay = page.locator('.TUXModal-overlay[data-transition-status="open"]');
    if (await openOverlay.isVisible({ timeout: 500 }).catch(() => false)) {
      await page.keyboard.press("Escape").catch(() => undefined);
      await page.waitForTimeout(400);
      clicked = true;
    }

    if (!clicked) break;
    await page.waitForTimeout(500);
  }
}

export async function ensureVideosTab(page: Page): Promise<void> {
  await dismissTikTokOverlays(page);

  const tab = page.locator('[data-e2e="videos-tab"]').first();
  if (!(await tab.isVisible({ timeout: 3000 }).catch(() => false))) return;

  const selected = await tab.getAttribute("aria-selected");
  if (selected === "true") return;

  await dismissTikTokOverlays(page);
  await tab.click({ timeout: 10000 }).catch(() => undefined);
  await page.waitForTimeout(800);
}

export async function waitForProfileGrid(page: Page, timeoutMs = 30000): Promise<boolean> {
  return page
    .locator("div[data-e2e='user-post-item']")
    .first()
    .waitFor({ state: "attached", timeout: timeoutMs })
    .then(() => true)
    .catch(() => false);
}
