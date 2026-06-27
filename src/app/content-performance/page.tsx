import Link from "next/link";
import { Suspense } from "react";

import { AnalyticsPageFrame } from "@/components/analytics/AnalyticsPageFrame";
import { loadAnalyticsSnapshot } from "@/lib/load-analytics-snapshot";
import { PaginatedPostsTable } from "@/components/analytics/PaginatedPostsTable";
import { DEFAULT_TARGET_ACCOUNTS } from "@/config/accounts";
import { accountLabel, accountPath, parseAccountKey } from "@/lib/account-route";
import { ui } from "@/lib/ui-classes";

export const dynamic = "force-dynamic";

export default async function ContentPerformancePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const snapshot = await loadAnalyticsSnapshot(searchParams);
  const selectedAccount = snapshot.filters.account;
  const selectedParsed =
    selectedAccount !== "all" ? parseAccountKey(selectedAccount) : null;

  return (
    <AnalyticsPageFrame title="All Posts" snapshot={snapshot}>
      <div className="space-y-5">
        <div className={`${ui.card} p-4`}>
          <p className="text-sm text-slate-600">
            Browse posts across accounts, or open a dedicated dashboard for one account.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {DEFAULT_TARGET_ACCOUNTS.map((account) => (
              <Link
                key={`${account.platform}-${account.username}`}
                href={accountPath(account.platform, account.username)}
                className={ui.btnPrimary}
              >
                {accountLabel(account.platform, account.username)}
              </Link>
            ))}
          </div>
        </div>

        <Suspense
          fallback={
            <div className={`${ui.cardMuted} p-8 text-center text-sm text-slate-500`}>
              Loading posts…
            </div>
          }
        >
          <PaginatedPostsTable
            postsPage={snapshot.postsPage}
            filters={snapshot.filters}
            showAccount={snapshot.filters.account === "all"}
            title={
              selectedParsed
                ? `All posts — ${accountLabel(selectedParsed.platform, selectedParsed.username)}`
                : "All posts (combined)"
            }
          />
        </Suspense>
      </div>
    </AnalyticsPageFrame>
  );
}
