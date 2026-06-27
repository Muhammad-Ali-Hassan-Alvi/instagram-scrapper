import { formatDateTime, formatNumber } from "@/lib/format";
import type { DashboardData } from "@/services/dashboard";

function StatCard({ label, value, compact }: { label: string; value: string; compact?: boolean }) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
      <p className="text-sm text-zinc-500">{label}</p>
      <p className={`mt-2 font-semibold tracking-tight ${compact ? "text-lg" : "text-3xl"}`}>
        {value}
      </p>
    </div>
  );
}

export function DashboardStats({ stats }: { stats: DashboardData["stats"] }) {
  return (
    <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard label="Posts tracked" value={formatNumber(stats.totalPosts)} />
      <StatCard label="Total views" value={formatNumber(stats.totalViews)} />
      <StatCard label="Total likes" value={formatNumber(stats.totalLikes)} />
      <StatCard
        label="Last refresh"
        compact
        value={stats.lastRefresh ? formatDateTime(stats.lastRefresh) : "—"}
      />
    </section>
  );
}
