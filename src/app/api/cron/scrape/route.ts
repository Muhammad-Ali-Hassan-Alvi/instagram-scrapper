import { NextResponse } from "next/server";

import { executeScheduledScrape } from "@/services/cron-job";
import { logger } from "@/utils/logger";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

function isAuthorized(request: Request): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return process.env.NODE_ENV !== "production";
  }

  const authHeader = request.headers.get("authorization");
  if (authHeader === `Bearer ${cronSecret}`) {
    return true;
  }

  // Vercel Cron also sends this header when CRON_SECRET is configured
  const vercelCron = request.headers.get("x-vercel-cron");
  return vercelCron === "1" && authHeader === `Bearer ${cronSecret}`;
}

async function handleCron(request: Request): Promise<NextResponse> {
  if (!isAuthorized(request)) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await executeScheduledScrape();

    if (!result) {
      return NextResponse.json({
        success: true,
        skipped: true,
        message: "Scrape already in progress",
      });
    }

    return NextResponse.json({
      success: true,
      accounts: result.accounts,
      csv: result.csv,
      startedAt: result.startedAt,
      completedAt: result.completedAt,
    });
  } catch (error) {
    logger.error("Cron scrape failed", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}

/** Daily scrape — triggered by Vercel Cron or external scheduler. */
export async function GET(request: Request): Promise<NextResponse> {
  return handleCron(request);
}

export async function POST(request: Request): Promise<NextResponse> {
  return handleCron(request);
}
