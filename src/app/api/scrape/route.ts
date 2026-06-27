import { NextResponse } from "next/server";

import { scrapeLockMessage } from "@/lib/scrape-lock";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SCRAPE_INSTRUCTIONS =
  "Playwright must run outside the web server. In a separate terminal run: npm run scrape:instagram (once) or npm run cron (daily).";

/** Disabled — scraping runs via CLI/cron, not inside Next.js. */
export async function POST(): Promise<NextResponse> {
  const lockMsg = scrapeLockMessage();

  return NextResponse.json(
    {
      success: false,
      error: lockMsg || SCRAPE_INSTRUCTIONS,
    },
    { status: 503 },
  );
}
