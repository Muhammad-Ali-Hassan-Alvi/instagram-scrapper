import { formatDateTime } from "@/lib/format";
import { ui } from "@/lib/ui-classes";
import type { AnalyticsSnapshot } from "@/types/analytics";

export function DbRefreshNotice({ snapshot }: { snapshot: AnalyticsSnapshot }) {
  const lastRefresh = snapshot.lastDataRefresh
    ? formatDateTime(snapshot.lastDataRefresh)
    : "Not scraped yet";

  return (
    <div className={`${ui.card} mb-4 flex flex-wrap items-center justify-between gap-3 px-4 py-3`}>
      <div>
        <p className="text-sm font-medium text-slate-900">Data source: MongoDB</p>
        <p className="text-xs text-slate-500">
          Last scrape saved to database: <span className="font-medium text-slate-700">{lastRefresh}</span>
        </p>
      </div>
      <p className="text-xs text-slate-500">
        Auto-refresh every 24h via <code className="rounded bg-slate-100 px-1">npm run cron</code>
      </p>
    </div>
  );
}
