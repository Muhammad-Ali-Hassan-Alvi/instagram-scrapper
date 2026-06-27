"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { accountLabel } from "@/lib/account-route";
import { formatDate, formatNumber } from "@/lib/format";
import { ui } from "@/lib/ui-classes";
import type { AnalyticsFilters, PostsPageResult } from "@/types/analytics";

function metricColumnClass(
  column: AnalyticsFilters["metric"] | "engagement" | "saves",
  activeMetric: AnalyticsFilters["metric"],
): string {
  const base = "px-4 py-2.5 text-right whitespace-nowrap";
  const active = column === activeMetric;
  return active ? `${base} font-semibold text-violet-700` : `${base} text-slate-700`;
}

export function PaginatedPostsTable({
  postsPage,
  filters,
  title,
  showAccount = false,
  basePath,
}: {
  postsPage: PostsPageResult;
  filters: AnalyticsFilters;
  title: string;
  showAccount?: boolean;
  basePath?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const routePath = basePath ?? pathname;
  const { rows, total, page, pageSize, totalPages } = postsPage;

  function updateQuery(updates: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (value === null) {
        params.delete(key);
      } else {
        params.set(key, value);
      }
    }
    router.push(`${routePath}?${params.toString()}`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function goToPage(nextPage: number) {
    if (nextPage < 1 || (totalPages > 0 && nextPage > totalPages)) return;
    updateQuery({ page: nextPage === 1 ? null : String(nextPage) });
  }

  if (!total) {
    return (
      <div className={`${ui.cardMuted} p-8 text-center text-sm text-slate-500`}>
        No posts in the database for this account yet. Run a scrape to load posts.
      </div>
    );
  }

  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);
  const pageNumbers = buildPageNumbers(page, totalPages);

  return (
    <div className={ui.card}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-4">
        <div>
          <h3 className="text-base font-semibold text-slate-900">{title}</h3>
          <p className="mt-0.5 text-sm text-slate-500">
            {formatNumber(total)} posts total · sorted by {filters.metric}
          </p>
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-600">
          Rows
          <select
            className={ui.input}
            value={pageSize >= total ? "all" : String(pageSize)}
            onChange={(event) => {
              const value = event.target.value;
              updateQuery({
                pageSize: value === "25" ? null : value === "all" ? "all" : value,
                page: null,
              });
            }}
          >
            <option value="25">25</option>
            <option value="50">50</option>
            <option value="100">100</option>
            <option value="250">250</option>
            <option value="all">All ({formatNumber(total)})</option>
          </select>
        </label>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className={ui.tableHead}>
            <tr>
              <th className="px-4 py-2.5 font-medium">#</th>
              {showAccount && <th className="px-4 py-2.5 font-medium">Account</th>}
              <th className="px-4 py-2.5 font-medium">Date</th>
              <th className="px-4 py-2.5 font-medium">Type</th>
              <th className="px-4 py-2.5 font-medium">Post URL</th>
              <th className={metricColumnClass("engagement", filters.metric)}>Engagement</th>
              <th className={metricColumnClass("views", filters.metric)}>Views</th>
              <th className={metricColumnClass("likes", filters.metric)}>Likes</th>
              <th className={metricColumnClass("comments", filters.metric)}>Comments</th>
              <th className={metricColumnClass("shares", filters.metric)}>Shares</th>
              <th className={metricColumnClass("saves", filters.metric)}>Saves</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((post, index) => (
              <tr
                key={`${post.platform}-${post.username}-${post.shortcode}`}
                className={ui.tableRow}
              >
                <td className="px-4 py-2.5 text-slate-400">{start + index}</td>
                {showAccount && (
                  <td className="px-4 py-2.5 font-medium text-slate-900">
                    {accountLabel(post.platform, post.username)}
                  </td>
                )}
                <td className="px-4 py-2.5 text-slate-600">{formatDate(post.postedAt)}</td>
                <td className="px-4 py-2.5 capitalize text-slate-600">{post.type}</td>
                <td className="max-w-[240px] truncate px-4 py-2.5">
                  {post.postUrl ? (
                    <a
                      href={post.postUrl}
                      target="_blank"
                      rel="noreferrer"
                      className={ui.link}
                      title={post.postUrl}
                    >
                      {post.postUrl.replace(/^https:\/\/(www\.)?/, "")}
                    </a>
                  ) : (
                    "—"
                  )}
                </td>
                <td className={metricColumnClass("engagement", filters.metric)}>
                  {formatNumber(post.engagement)}
                </td>
                <td className={metricColumnClass("views", filters.metric)}>
                  {formatNumber(post.views)}
                </td>
                <td className={metricColumnClass("likes", filters.metric)}>
                  {formatNumber(post.likes)}
                </td>
                <td className={metricColumnClass("comments", filters.metric)}>
                  {formatNumber(post.comments)}
                </td>
                <td className={metricColumnClass("shares", filters.metric)}>
                  {formatNumber(post.shares)}
                </td>
                <td className={metricColumnClass("saves", filters.metric)}>
                  {formatNumber(post.saves)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && pageSize < total && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-4 py-3">
          <p className="text-sm text-slate-500">
            Showing {start.toLocaleString()}–{end.toLocaleString()} of {total.toLocaleString()}
          </p>
          <div className="flex flex-wrap items-center gap-1">
            <button type="button" onClick={() => goToPage(1)} disabled={page <= 1} className={ui.btn}>
              «
            </button>
            <button
              type="button"
              onClick={() => goToPage(page - 1)}
              disabled={page <= 1}
              className={ui.btn}
            >
              Prev
            </button>
            {pageNumbers.map((pageNumber) =>
              pageNumber === "…" ? (
                <span key={`ellipsis-${pageNumber}-${Math.random()}`} className="px-2 text-slate-400">
                  …
                </span>
              ) : (
                <button
                  key={pageNumber}
                  type="button"
                  onClick={() => goToPage(pageNumber)}
                  className={`min-w-9 rounded-lg px-2 py-1.5 text-sm ${
                    pageNumber === page
                      ? "bg-violet-600 font-medium text-white"
                      : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  {pageNumber}
                </button>
              ),
            )}
            <button
              type="button"
              onClick={() => goToPage(page + 1)}
              disabled={page >= totalPages}
              className={ui.btn}
            >
              Next
            </button>
            <button
              type="button"
              onClick={() => goToPage(totalPages)}
              disabled={page >= totalPages}
              className={ui.btn}
            >
              »
            </button>
          </div>
        </div>
      )}

      {(pageSize >= total || totalPages <= 1) && (
        <div className="border-t border-slate-200 px-4 py-3 text-sm text-slate-500">
          Showing all {formatNumber(total)} posts
        </div>
      )}
    </div>
  );
}

function buildPageNumbers(current: number, totalPages: number): (number | "…")[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const pages: (number | "…")[] = [1];
  if (current > 3) pages.push("…");

  const start = Math.max(2, current - 1);
  const end = Math.min(totalPages - 1, current + 1);
  for (let page = start; page <= end; page += 1) {
    pages.push(page);
  }

  if (current < totalPages - 2) pages.push("…");
  pages.push(totalPages);
  return pages;
}

export function ViewAllPostsLink({
  platform = "instagram",
  account,
  metric,
}: {
  platform?: string;
  account?: string;
  metric?: string;
}) {
  const params = new URLSearchParams({ platform });
  if (metric) params.set("metric", metric);
  const query = params.toString();

  return (
    <Link
      href={`/accounts/${account}?${query}`}
      className={ui.link}
    >
      View all posts →
    </Link>
  );
}
