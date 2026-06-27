"use client";

import Link from "next/link";

import { ViewAllPostsLink } from "@/components/analytics/PaginatedPostsTable";
import { accountKey, accountLabel, accountPath, parseAccountKey, platformLabel } from "@/lib/account-route";
import { formatDate, formatNumber } from "@/lib/format";
import { ui } from "@/lib/ui-classes";
import type { AnalyticsSnapshot, TopPostRow } from "@/types/analytics";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export function TopPostsTable({
  posts,
  title = "Top posts",
}: {
  posts: TopPostRow[];
  title?: string;
}) {
  if (!posts.length) {
    return (
      <div className={`${ui.cardMuted} p-6 text-center text-sm text-slate-500`}>
        No posts for this account yet.
      </div>
    );
  }

  return (
    <div className={ui.card}>
      <div className="border-b border-slate-200 px-4 py-3">
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className={ui.tableHead}>
            <tr>
              <th className="px-4 py-2 font-medium">Date</th>
              <th className="px-4 py-2 font-medium">Type</th>
              <th className="px-4 py-2 font-medium">URL</th>
              <th className="px-4 py-2 text-right font-medium">Engagement</th>
              <th className="px-4 py-2 text-right font-medium">Views</th>
            </tr>
          </thead>
          <tbody>
            {posts.slice(0, 5).map((post) => (
              <tr key={`${post.platform}-${post.username}-${post.shortcode}`} className={ui.tableRow}>
                <td className="px-4 py-2 text-slate-600">{formatDate(post.postedAt)}</td>
                <td className="px-4 py-2 capitalize text-slate-600">{post.type}</td>
                <td className="max-w-[200px] truncate px-4 py-2">
                  {post.postUrl ? (
                    <a href={post.postUrl} target="_blank" rel="noreferrer" className={ui.link}>
                      Open
                    </a>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-4 py-2 text-right font-medium text-violet-700">
                  {formatNumber(post.engagement)}
                </td>
                <td className="px-4 py-2 text-right text-slate-700">{formatNumber(post.views)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function AccountSplitSections({ snapshot }: { snapshot: AnalyticsSnapshot }) {
  if (snapshot.filters.account !== "all" || !snapshot.topPostsByAccount.length) {
    return null;
  }

  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold text-slate-900">Quick preview by account</h2>
      <div className="grid gap-4 xl:grid-cols-2">
        {snapshot.topPostsByAccount.map((slice) => {
          const summary = snapshot.accountSummaries.find(
            (row) => row.username === slice.username && row.platform === slice.platform,
          );
          const sliceKey = accountKey(slice.platform, slice.username);

          return (
            <div key={sliceKey} className={`${ui.card} p-4`}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <Link
                    href={accountPath(slice.platform, slice.username)}
                    className="text-lg font-semibold text-slate-900 hover:text-violet-700"
                  >
                    {accountLabel(slice.platform, slice.username)}
                  </Link>
                  <p className="mt-1 text-sm text-slate-500">
                    {formatNumber(summary?.scrapedPosts ?? slice.kpis.totalPosts)} posts ·{" "}
                    {formatNumber(slice.kpis.totalEngagement)} engagement
                  </p>
                </div>
                <Link
                  href={accountPath(slice.platform, slice.username)}
                  className={ui.btnPrimary}
                >
                  Open
                </Link>
              </div>
              <div className="mt-3">
                <TopPostsTable
                  posts={slice.topPosts}
                  title={`Top ${snapshot.filters.metric} posts`}
                />
              </div>
              <div className="mt-3 flex flex-wrap gap-4 text-sm">
                <ViewAllPostsLink
                  platform={slice.platform}
                  account={slice.username}
                  metric={snapshot.filters.metric}
                />
                <a
                  href={`/api/export?format=csv&account=${slice.username}&platform=${slice.platform}`}
                  className={ui.link}
                >
                  Download CSV
                </a>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export function ContentPerformanceCharts({ snapshot }: { snapshot: AnalyticsSnapshot }) {
  const byAccount = snapshot.sharesByAccount.map((row) => {
    const parsed = parseAccountKey(row.name);
    return {
      account: parsed ? accountLabel(parsed.platform, parsed.username) : row.name,
      engagement: row.value,
    };
  });

  return (
    <div className={`${ui.card} p-4`}>
      <h3 className="mb-3 text-sm font-semibold text-slate-900">Engagement by account</h3>
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={byAccount}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="account" stroke="#64748b" />
          <YAxis stroke="#64748b" tickFormatter={formatNumber} />
          <Tooltip contentStyle={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8 }} />
          <Bar dataKey="engagement" fill="#7c3aed" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function AudienceInsightsPanel({ snapshot }: { snapshot: AnalyticsSnapshot }) {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        {snapshot.insightsNote}
      </div>
      <div className={`${ui.card} p-4`}>
        <h3 className="text-sm font-semibold text-slate-900">Followers by account</h3>
        <ul className="mt-4 space-y-2">
          {snapshot.accountSummaries.map((row) => (
            <li key={accountKey(row.platform, row.username)} className="flex justify-between text-sm">
              <Link href={accountPath(row.platform, row.username)} className={ui.link}>
                {accountLabel(row.platform, row.username)}
              </Link>
              <span className="text-slate-500">
                {formatNumber(row.followers)} followers · {formatNumber(row.scrapedPosts)} posts
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export function PlatformBenchmarkPanel({ snapshot }: { snapshot: AnalyticsSnapshot }) {
  const data = snapshot.platformComparison.map((row) => {
    const total = row.likes + row.comments + row.shares + row.saves || 1;
    return {
      platform: platformLabel(row.platform),
      likesPct: Number(((row.likes / total) * 100).toFixed(1)),
      commentsPct: Number(((row.comments / total) * 100).toFixed(1)),
      sharesPct: Number(((row.shares / total) * 100).toFixed(1)),
      savesPct: Number(((row.saves / total) * 100).toFixed(1)),
    };
  });

  return (
    <div className={`${ui.card} p-4`}>
      <h3 className="mb-3 text-sm font-semibold text-slate-900">Platform engagement mix (%)</h3>
      {data.length ? (
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="platform" stroke="#64748b" />
            <YAxis stroke="#64748b" unit="%" />
            <Tooltip contentStyle={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8 }} />
            <Legend />
            <Bar dataKey="likesPct" name="Likes" stackId="a" fill="#7c3aed" />
            <Bar dataKey="commentsPct" name="Comments" stackId="a" fill="#0891b2" />
            <Bar dataKey="sharesPct" name="Shares" stackId="a" fill="#6366f1" />
            <Bar dataKey="savesPct" name="Saves" stackId="a" fill="#a855f7" />
          </BarChart>
        </ResponsiveContainer>
      ) : (
        <p className="py-16 text-center text-sm text-slate-500">No platform comparison data yet.</p>
      )}
    </div>
  );
}
