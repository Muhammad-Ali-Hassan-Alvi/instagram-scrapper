import { formatNumber } from "@/lib/format";
import { ui } from "@/lib/ui-classes";
import type { AnalyticsKpis } from "@/types/analytics";

const KPI_ITEMS: {
  key: keyof AnalyticsKpis;
  label: string;
  insightsOnly?: boolean;
}[] = [
  { key: "totalPosts", label: "Posts" },
  { key: "totalViews", label: "Views" },
  { key: "totalLikes", label: "Likes" },
  { key: "totalComments", label: "Comments" },
  { key: "totalShares", label: "Shares" },
  { key: "totalSaves", label: "Saves" },
  { key: "totalEngagement", label: "Engagement" },
  { key: "totalFollowers", label: "Followers" },
  { key: "avgEngagementRate", label: "Eng. Rate" },
  { key: "totalReach", label: "Reach", insightsOnly: true },
  { key: "totalViewers", label: "Viewers", insightsOnly: true },
  { key: "totalSpend", label: "Ad Spend", insightsOnly: true },
];

function formatKpi(key: keyof AnalyticsKpis, value: number | null): string {
  if (value === null) return "N/A";
  if (key === "avgEngagementRate") return `${value}%`;
  return formatNumber(value);
}

export function KpiStrip({
  kpis,
  compact = false,
}: {
  kpis: AnalyticsKpis;
  compact?: boolean;
}) {
  const items = compact
    ? KPI_ITEMS.filter((item) => !item.insightsOnly || kpis[item.key] !== null)
    : KPI_ITEMS;

  return (
    <section
      className={`grid gap-3 ${
        compact
          ? "grid-cols-2 sm:grid-cols-3 xl:grid-cols-5"
          : "grid-cols-2 md:grid-cols-3 xl:grid-cols-6"
      }`}
    >
      {items.map((item) => (
        <div key={item.key} className={`${ui.card} px-4 py-3`}>
          <p className={ui.label}>{item.label}</p>
          <p className="mt-1 text-xl font-semibold text-slate-900">
            {formatKpi(item.key, kpis[item.key])}
          </p>
          {item.insightsOnly && kpis[item.key] === null && (
            <p className="mt-1 text-[10px] text-slate-400">Insights only</p>
          )}
        </div>
      ))}
    </section>
  );
}
