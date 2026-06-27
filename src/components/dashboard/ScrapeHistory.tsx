import { formatDateTime } from "@/lib/format";
import type { DashboardScrapeRun } from "@/services/dashboard";

export function ScrapeHistory({ scrapes }: { scrapes: DashboardScrapeRun[] }) {
  if (!scrapes.length) {
    return (
      <div className="rounded-xl border border-dashed border-zinc-300 bg-white p-6 text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900">
        No scrape runs logged yet.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
        {scrapes.map((scrape, index) => (
          <li key={`${scrape.username}-${scrape.startedAt.toString()}-${index}`} className="px-4 py-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-3">
                <span
                  className={`h-2 w-2 rounded-full ${scrape.success ? "bg-emerald-500" : "bg-red-500"}`}
                />
                <span className="text-sm font-medium">@{scrape.username}</span>
                <span className="text-sm text-zinc-500">{formatDateTime(scrape.startedAt)}</span>
              </div>
              <span className="text-sm text-zinc-600 dark:text-zinc-400">
                {scrape.success
                  ? `${scrape.postsInserted} new · ${scrape.postsUpdated} updated`
                  : (scrape.errorMessage ?? "Failed")}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
