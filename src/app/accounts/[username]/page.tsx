import { notFound } from "next/navigation";
import { Suspense } from "react";

import { AnalyticsPageFrame } from "@/components/analytics/AnalyticsPageFrame";
import { loadAnalyticsSnapshot } from "@/lib/load-analytics-snapshot";
import { ContentPerformanceCharts } from "@/components/analytics/AnalyticsViews";
import { PaginatedPostsTable } from "@/components/analytics/PaginatedPostsTable";
import { KpiStrip } from "@/components/analytics/KpiStrip";
import { DEFAULT_TARGET_ACCOUNTS } from "@/config/accounts";
import { formatNumber } from "@/lib/format";
import { ui } from "@/lib/ui-classes";

export const dynamic = "force-dynamic";

const VALID_USERNAMES = new Set(
  DEFAULT_TARGET_ACCOUNTS.filter((account) => account.platform === "instagram").map(
    (account) => account.username,
  ),
);

export default async function AccountDashboardPage({
  params,
  searchParams,
}: {
  params: Promise<{ username: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { username } = await params;
  const normalized = username.toLowerCase();

  if (!VALID_USERNAMES.has(normalized)) {
    notFound();
  }

  const rawParams = await searchParams;
  const snapshot = await loadAnalyticsSnapshot({ ...rawParams, account: normalized });
  const summary = snapshot.accountSummaries.find((row) => row.username === normalized);

  return (
    <AnalyticsPageFrame title={`@${normalized}`} snapshot={snapshot}>
      <div className="space-y-5">
        <div className={`${ui.card} p-4`}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className={ui.label}>Account dashboard</p>
              <h2 className="text-2xl font-semibold text-slate-900">@{normalized}</h2>
            </div>
            <div className="flex flex-wrap gap-2">
              <a href={`/api/export?format=csv&account=${normalized}`} className={ui.btn}>
                Export CSV
              </a>
              <a href={`/api/export?format=pdf&account=${normalized}`} className={ui.btn}>
                Export PDF
              </a>
            </div>
          </div>
          {summary && (
            <p className="mt-3 text-sm text-slate-600">
              <span className="font-medium text-slate-900">
                {formatNumber(summary.scrapedPosts)} posts loaded
              </span>
              {summary.totalPosts > 0 && (
                <>
                  {" "}
                  of {formatNumber(summary.totalPosts)} on Instagram
                  {summary.scrapedPosts < summary.totalPosts && (
                    <span className="text-amber-700">
                      {" "}
                      — run scrape to load the rest
                    </span>
                  )}
                </>
              )}
            </p>
          )}
        </div>

        <KpiStrip kpis={snapshot.kpis} compact />
        <ContentPerformanceCharts snapshot={snapshot} />

        <Suspense
          fallback={
            <div className={`${ui.cardMuted} p-8 text-center text-sm text-slate-500`}>
              Loading posts…
            </div>
          }
        >
          <PaginatedPostsTable
            postsPage={snapshot.postsPage}
            filters={snapshot.filters}
            title={`All posts — @${normalized}`}
            basePath={`/accounts/${normalized}`}
          />
        </Suspense>
      </div>
    </AnalyticsPageFrame>
  );
}
