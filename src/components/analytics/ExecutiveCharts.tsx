"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { formatNumber } from "@/lib/format";
import { ui } from "@/lib/ui-classes";
import type { AnalyticsSnapshot } from "@/types/analytics";

const COLORS = ["#7c3aed", "#0891b2", "#6366f1", "#a855f7", "#0ea5e9"];

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className={`${ui.card} p-4`}>
      <h3 className="mb-3 text-sm font-semibold text-slate-900">{title}</h3>
      {children}
    </div>
  );
}

export function ExecutiveCharts({ snapshot }: { snapshot: AnalyticsSnapshot }) {
  const metricKey = snapshot.filters.metric;
  const metricLabel = metricKey.charAt(0).toUpperCase() + metricKey.slice(1);
  const trendKey = metricKey === "engagement" ? "engagement" : metricKey;

  const platformData = snapshot.platformComparison.map((row) => ({
    platform: row.platform.charAt(0).toUpperCase() + row.platform.slice(1),
    Likes: row.likes,
    Comments: row.comments,
    Shares: row.shares,
    Saves: row.saves,
  }));

  const weeklyMap = new Map<string, Record<string, number | string>>();
  for (const point of snapshot.weeklyByCategory) {
    const existing = weeklyMap.get(point.week) ?? { week: point.week };
    existing[point.category] = ((existing[point.category] as number) ?? 0) + point.value;
    weeklyMap.set(point.week, existing);
  }
  const weeklyData = [...weeklyMap.values()];
  const categories = [...new Set(snapshot.weeklyByCategory.map((point) => point.category))];

  return (
    <div className="grid gap-4 xl:grid-cols-12">
      <div className="xl:col-span-4">
        <ChartCard title="Engagement by account">
          {snapshot.sharesByAccount.length ? (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={snapshot.sharesByAccount}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={55}
                  outerRadius={90}
                  paddingAngle={2}
                >
                  {snapshot.sharesByAccount.map((_, index) => (
                    <Cell key={index} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value) => formatNumber(Number(value))}
                  contentStyle={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8 }}
                />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart message="No data yet" />
          )}
        </ChartCard>
      </div>

      <div className="xl:col-span-8">
        <ChartCard title={`${metricLabel} over time`}>
          {snapshot.trendByMonth.length ? (
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={snapshot.trendByMonth}>
                <defs>
                  <linearGradient id="metricFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#7c3aed" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#7c3aed" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="label" stroke="#64748b" tick={{ fontSize: 11 }} />
                <YAxis stroke="#64748b" tick={{ fontSize: 11 }} tickFormatter={formatNumber} />
                <Tooltip
                  formatter={(value) => formatNumber(Number(value))}
                  contentStyle={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8 }}
                />
                <Area type="monotone" dataKey={trendKey} stroke="#7c3aed" fill="url(#metricFill)" />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart message="No trend data yet" />
          )}
        </ChartCard>
      </div>

      <div className="xl:col-span-6">
        <ChartCard title="Platform performance">
          {platformData.length ? (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={platformData} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis type="number" stroke="#64748b" tickFormatter={formatNumber} />
                <YAxis type="category" dataKey="platform" stroke="#64748b" width={80} />
                <Tooltip contentStyle={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8 }} />
                <Legend />
                <Bar dataKey="Likes" stackId="a" fill="#7c3aed" />
                <Bar dataKey="Comments" stackId="a" fill="#0891b2" />
                <Bar dataKey="Shares" stackId="a" fill="#6366f1" />
                <Bar dataKey="Saves" stackId="a" fill="#a855f7" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart message="No platform data yet" />
          )}
        </ChartCard>
      </div>

      <div className="xl:col-span-6">
        <ChartCard title={`Weekly ${metricLabel}`}>
          {weeklyData.length ? (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={weeklyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="week" stroke="#64748b" tick={{ fontSize: 11 }} />
                <YAxis stroke="#64748b" tickFormatter={formatNumber} />
                <Tooltip contentStyle={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8 }} />
                <Legend />
                {categories.map((category, index) => (
                  <Bar
                    key={category}
                    dataKey={category}
                    stackId="stack"
                    fill={COLORS[index % COLORS.length]}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart message="No weekly data yet" />
          )}
        </ChartCard>
      </div>
    </div>
  );
}

function EmptyChart({ message }: { message: string }) {
  return (
    <div className="flex h-[260px] items-center justify-center text-sm text-slate-500">{message}</div>
  );
}
