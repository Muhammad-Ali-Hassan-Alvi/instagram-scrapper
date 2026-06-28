"""
Run TikTok-Content-Scraper using video IDs discovered by Playwright.

Discovery step (Node): npm run tiktok:ttcs:discover
Full pipeline: npm run scrape:tiktok:ttcs
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
VENDOR = ROOT / "vendor" / "tiktok-content-scraper"
DATA_DIR = ROOT / "data" / "ttcs"
DISCOVERY_FILE = DATA_DIR / "discovered-ids.json"
PROGRESS_DB = DATA_DIR / "progress_tracking" / "scraping_progress.db"


def ensure_vendor_on_path() -> None:
    if not VENDOR.exists():
        raise RuntimeError(
            "TikTok-Content-Scraper not installed. Run: npm run tiktok:ttcs:setup"
        )
    sys.path.insert(0, str(VENDOR))


def load_discovered_accounts() -> list[dict]:
    if not DISCOVERY_FILE.exists():
        raise SystemExit(
            f"Missing {DISCOVERY_FILE}. Run: npm run tiktok:ttcs:discover"
        )

    payload = json.loads(DISCOVERY_FILE.read_text(encoding="utf-8"))
    accounts = payload.get("accounts") or []
    if not accounts:
        raise SystemExit(f"No accounts in {DISCOVERY_FILE}")
    return accounts


def pick_browser_name() -> str | None:
    for name in ("chrome", "edge", "firefox"):
        try:
            import browser_cookie3

            getattr(browser_cookie3, name)(domain_name=".tiktok.com")
            return name
        except Exception:
            continue
    return None


def main() -> None:
    ensure_vendor_on_path()
    from TT_Content_Scraper import TT_Content_Scraper

    accounts = load_discovered_accounts()
    browser_name = pick_browser_name()

    scraper = TT_Content_Scraper(
        wait_time=0.45,
        output_files_fp=str(DATA_DIR),
        progress_file_fn=str(PROGRESS_DB),
        clear_console=False,
        browser_name=browser_name,
    )

    all_video_ids: list[str] = []

    for account in accounts:
        username = str(account.get("username", "")).lstrip("@")
        video_ids = [str(video_id) for video_id in (account.get("videoIds") or []) if video_id]
        if not username or not video_ids:
            print(f"Skipping @{username or '?'} — no video IDs")
            continue

        print(f"@{username}: queueing {len(video_ids)} videos for TTCS metadata scrape")
        scraper.add_objects(ids=[username], title="dashboard targets", type="user")
        scraper.add_objects(ids=video_ids, title=f"@{username} videos", type="content")
        all_video_ids.extend(video_ids)

    if not all_video_ids:
        raise SystemExit(
            "No video IDs to scrape. Run npm run tiktok:ttcs:discover after npm run tiktok:login"
        )

    print(f"Scraping metadata for {len(all_video_ids)} videos (no media files)...")
    scraper.scrape_pending(only_content=True, scrape_files=False)
    print(f"Done. JSON output: {DATA_DIR / 'content_metadata'}")


if __name__ == "__main__":
    main()
