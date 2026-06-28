import { AnalyticsShell } from "@/components/analytics/AnalyticsShell";
import { ApifySettingsPanel } from "@/components/apify/ApifySettingsPanel";

export const dynamic = "force-dynamic";

export default function ApifyPage() {
  return (
    <AnalyticsShell title="Apify Scraper">
      <ApifySettingsPanel />
    </AnalyticsShell>
  );
}
