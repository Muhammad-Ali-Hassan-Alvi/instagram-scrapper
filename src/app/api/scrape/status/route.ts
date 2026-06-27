import { NextResponse } from "next/server";

import { getEnv, hasInstagramCredentials } from "@/config/env";
import { isScrapeInProgress } from "@/services/cron-job";
import { getDataReadiness } from "@/services/scrape-readiness";
import { getScrapeStateSnapshot } from "@/services/scrape-state";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Live scrape + data readiness for the visit bootstrap gate. */
export async function GET(): Promise<NextResponse> {
  const env = getEnv();
  const readiness = await getDataReadiness();
  const state = getScrapeStateSnapshot();

  return NextResponse.json({
    ready: readiness.ready,
    stale: readiness.stale,
    needsScrape: readiness.needsScrape,
    inProgress: isScrapeInProgress(),
    autoScrapeEnabled: env.AUTO_SCRAPE_ON_VISIT,
    hasCredentials: hasInstagramCredentials(),
    reason: readiness.reason,
    accounts: readiness.accounts,
    phase: state.phase,
    message: state.message,
    progress: state.accounts,
    startedAt: state.startedAt,
    completedAt: state.completedAt,
    error: state.error,
  });
}
