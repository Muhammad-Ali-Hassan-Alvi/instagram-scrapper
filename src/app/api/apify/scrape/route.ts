import { NextResponse } from "next/server";

import { getApifySettingsPublic } from "@/services/apify-settings";
import { isApifyScrapeInProgress, startApifyScrapeBackground } from "@/services/apify-scraper";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(): Promise<NextResponse> {
  try {
    const settings = await getApifySettingsPublic();
    return NextResponse.json({
      ...settings,
      inProgress: isApifyScrapeInProgress() || settings.scrapeStatus === "running",
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load Apify status." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      platform?: "instagram" | "tiktok";
      username?: string;
    };

    const hasPlatform = Boolean(body.platform);
    const hasUsername = Boolean(body.username?.trim());

    if (hasPlatform !== hasUsername) {
      return NextResponse.json(
        { error: "Provide both platform and username to scrape one account." },
        { status: 400 },
      );
    }

    const result = await startApifyScrapeBackground(
      hasPlatform && hasUsername
        ? { platform: body.platform, username: body.username!.trim() }
        : undefined,
    );

    if (!result.started) {
      return NextResponse.json({ error: result.error ?? "Could not start scrape." }, { status: 409 });
    }

    return NextResponse.json({ started: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to start Apify scrape." },
      { status: 500 },
    );
  }
}
