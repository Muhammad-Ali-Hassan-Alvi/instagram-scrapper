import { AnalyticsPageFrame } from "@/components/analytics/AnalyticsPageFrame";
import { loadAnalyticsSnapshot } from "@/lib/load-analytics-snapshot";
import { PlatformBenchmarkPanel } from "@/components/analytics/AnalyticsViews";
import { ExecutiveCharts } from "@/components/analytics/ExecutiveCharts";
import { KpiStrip } from "@/components/analytics/KpiStrip";

export const dynamic = "force-dynamic";

export default async function PlatformBenchmarkingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const snapshot = await loadAnalyticsSnapshot(searchParams);

  return (
    <AnalyticsPageFrame title="Platform Benchmarking" snapshot={snapshot}>
      <div className="space-y-4">
        <KpiStrip kpis={snapshot.kpis} />
        <PlatformBenchmarkPanel snapshot={snapshot} />
        <ExecutiveCharts snapshot={snapshot} />
      </div>
    </AnalyticsPageFrame>
  );
}
