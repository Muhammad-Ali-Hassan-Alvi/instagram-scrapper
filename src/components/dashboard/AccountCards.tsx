import { platformLabel, profileUrl } from "@/lib/account-route";
import { formatDateTime, formatNumber } from "@/lib/format";
import type { DashboardAccount } from "@/services/dashboard";

export function AccountCards({ accounts }: { accounts: DashboardAccount[] }) {
  if (!accounts.length) {
    return (
      <div className="rounded-xl border border-dashed border-zinc-300 bg-white p-8 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900">
        No accounts in database yet. Run a scrape to populate data.
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {accounts.map((account) => (
        <article
          key={`${account.platform}-${account.username}`}
          className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-wide text-zinc-500">
                {platformLabel(account.platform)}
              </p>
              <h3 className="mt-1 text-lg font-semibold">@{account.username}</h3>
              {account.displayName && (
                <p className="text-sm text-zinc-600 dark:text-zinc-400">{account.displayName}</p>
              )}
            </div>
            {account.category && (
              <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                {account.category}
              </span>
            )}
          </div>

          <dl className="mt-5 grid grid-cols-3 gap-3 text-sm">
            <div>
              <dt className="text-zinc-500">Followers</dt>
              <dd className="mt-1 font-medium">{formatNumber(account.followers)}</dd>
            </div>
            <div>
              <dt className="text-zinc-500">Scraped</dt>
              <dd className="mt-1 font-medium">
                {formatNumber(account.scrapedPosts)}
                {account.totalPosts > 0 && (
                  <span className="text-zinc-400"> / {formatNumber(account.totalPosts)}</span>
                )}
              </dd>
            </div>
            <div>
              <dt className="text-zinc-500">Last scrape</dt>
              <dd className="mt-1 font-medium">{formatDateTime(account.lastScrapedAt)}</dd>
            </div>
          </dl>

          <a
            href={profileUrl(account.platform, account.username)}
            target="_blank"
            rel="noreferrer"
            className="mt-4 inline-block text-sm text-zinc-600 underline-offset-2 hover:underline dark:text-zinc-400"
          >
            View on {platformLabel(account.platform)} →
          </a>
        </article>
      ))}
    </div>
  );
}
