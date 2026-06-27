import { AnalyticsPageFrame } from "@/components/analytics/AnalyticsPageFrame";
import { loadAnalyticsSnapshot } from "@/lib/load-analytics-snapshot";
import { AudienceInsightsPanel } from "@/components/analytics/AnalyticsViews";
import { KpiStrip } from "@/components/analytics/KpiStrip";

export const dynamic = "force-dynamic";

export default async function AudienceInsightsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const snapshot = await loadAnalyticsSnapshot(searchParams);

  return (
    <AnalyticsPageFrame title="Audience Insights" snapshot={snapshot}>
      <div className="space-y-4">
        <KpiStrip kpis={snapshot.kpis} />
        <AudienceInsightsPanel snapshot={snapshot} />
      </div>
    </AnalyticsPageFrame>
  );
}
