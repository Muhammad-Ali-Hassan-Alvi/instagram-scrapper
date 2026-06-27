import { existsSync, readFileSync, unlinkSync, writeFileSync } from "fs";
import { join } from "path";

const LOCK_PATH = join(process.cwd(), ".scrape.lock");

export function acquireScrapeLock(): boolean {
  if (existsSync(LOCK_PATH)) {
    return false;
  }
  writeFileSync(LOCK_PATH, String(process.pid), "utf8");
  return true;
}

export function releaseScrapeLock(): void {
  try {
    unlinkSync(LOCK_PATH);
  } catch {
    // ignore
  }
}

export function scrapeLockMessage(): string {
  if (!existsSync(LOCK_PATH)) {
    return "";
  }
  try {
    const pid = readFileSync(LOCK_PATH, "utf8").trim();
    return `Scrape already running (pid ${pid}). Wait for it to finish.`;
  } catch {
    return "Scrape already running.";
  }
}
