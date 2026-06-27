import Link from "next/link";

import { accountKey, accountPath, platformLabel } from "@/lib/account-route";
import { ui } from "@/lib/ui-classes";
import { formatNumber } from "@/lib/format";
import type { AnalyticsSnapshot } from "@/types/analytics";

export function AccountHub({ snapshot }: { snapshot: AnalyticsSnapshot }) {
  const accounts = snapshot.topPostsByAccount.length
    ? snapshot.topPostsByAccount.map((slice) => ({
        platform: slice.platform,
        username: slice.username,
        totalPosts: slice.kpis.totalPosts,
        totalEngagement: slice.kpis.totalEngagement,
        totalFollowers: slice.kpis.totalFollowers,
      }))
    : snapshot.accountSummaries.map((summary) => ({
        platform: summary.platform,
        username: summary.username,
        totalPosts: summary.scrapedPosts,
        totalEngagement: 0,
        totalFollowers: summary.followers,
      }));

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Accounts</h2>
        <p className="mt-1 text-sm text-slate-500">
          Open each account separately to browse all posts, metrics, and exports.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {accounts.map((account) => {
          const summary = snapshot.accountSummaries.find(
            (row) =>
              row.username === account.username && row.platform === account.platform,
          );
          const scraped = summary?.scrapedPosts ?? account.totalPosts;
          const expected = summary?.totalPosts ?? 0;
          const complete = expected > 0 ? scraped >= expected : scraped > 0;
          const key = accountKey(account.platform, account.username);

          return (
            <Link
              key={key}
              href={accountPath(account.platform, account.username)}
              className={`${ui.card} group block p-5 transition hover:border-violet-300 hover:shadow-md`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className={ui.label}>{platformLabel(account.platform)}</p>
                  <h3 className="mt-1 text-xl font-semibold text-slate-900">
                    @{account.username}
                  </h3>
                </div>
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                    complete
                      ? "bg-emerald-50 text-emerald-700"
                      : "bg-amber-50 text-amber-700"
                  }`}
                >
                  {complete ? "Complete" : "Partial"}
                </span>
              </div>
              <dl className="mt-4 grid grid-cols-3 gap-3 text-sm">
                <div>
                  <dt className={ui.muted}>Posts in DB</dt>
                  <dd className="mt-0.5 font-semibold text-slate-900">
                    {formatNumber(scraped)}
                    {expected > 0 && (
                      <span className="font-normal text-slate-500">
                        {" "}
                        / {formatNumber(expected)}
                      </span>
                    )}
                  </dd>
                </div>
                <div>
                  <dt className={ui.muted}>Engagement</dt>
                  <dd className="mt-0.5 font-semibold text-slate-900">
                    {formatNumber(account.totalEngagement)}
                  </dd>
                </div>
                <div>
                  <dt className={ui.muted}>Followers</dt>
                  <dd className="mt-0.5 font-semibold text-slate-900">
                    {formatNumber(account.totalFollowers)}
                  </dd>
                </div>
              </dl>
              <p className="mt-4 text-sm font-medium text-violet-600 group-hover:text-violet-700">
                Open dashboard →
              </p>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
