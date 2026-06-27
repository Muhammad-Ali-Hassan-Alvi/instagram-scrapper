import { AccountHub } from "@/components/analytics/AccountHub";
import { AnalyticsPageFrame } from "@/components/analytics/AnalyticsPageFrame";
import { loadAnalyticsSnapshot } from "@/lib/load-analytics-snapshot";
import { ExecutiveCharts } from "@/components/analytics/ExecutiveCharts";
import { KpiStrip } from "@/components/analytics/KpiStrip";
import { AccountSplitSections } from "@/components/analytics/AnalyticsViews";
import { ScrapeStatusBanner } from "@/components/analytics/ScrapeStatusBanner";

export const dynamic = "force-dynamic";

export default async function ExecutiveOverviewPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const snapshot = await loadAnalyticsSnapshot(searchParams);

  return (
    <AnalyticsPageFrame title="Overview" snapshot={snapshot}>
      <div className="space-y-6">
        <ScrapeStatusBanner accounts={snapshot.accountSummaries} />
        <AccountHub snapshot={snapshot} />
        <KpiStrip kpis={snapshot.kpis} compact />
        <ExecutiveCharts snapshot={snapshot} />
        <AccountSplitSections snapshot={snapshot} />
        <p className="text-xs text-slate-400">{snapshot.insightsNote}</p>
      </div>
    </AnalyticsPageFrame>
  );
}
