"use client";

import { accountKey, platformLabel } from "@/lib/account-route";
import { formatNumber } from "@/lib/format";

export function ScrapeStatusBanner({
  accounts,
}: {
  accounts: {
    platform: string;
    username: string;
    scrapedPosts: number;
    totalPosts: number;
  }[];
}) {
  const incomplete = accounts.filter(
    (account) => account.totalPosts > 0 && account.scrapedPosts < account.totalPosts,
  );

  const showBanner = incomplete.length > 0 || accounts.length === 0;

  if (!showBanner) {
    return null;
  }

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-4">
      <p className="text-sm font-medium text-amber-950">
        {incomplete.length > 0 ? "Database is missing some posts" : "No scraped data in MongoDB yet"}
      </p>
      {incomplete.length > 0 && (
        <ul className="mt-2 space-y-1 text-sm text-amber-900">
          {incomplete.map((account) => (
            <li key={accountKey(account.platform, account.username)}>
              {platformLabel(account.platform)} @{account.username}: {formatNumber(account.scrapedPosts)} /{" "}
              {formatNumber(account.totalPosts)} posts in DB
            </li>
          ))}
        </ul>
      )}
      <p className="mt-2 text-xs text-amber-800">
        The dashboard reads saved MongoDB data only. Run scraping in a <strong>separate terminal</strong>{" "}
        (not inside <code className="rounded bg-amber-100 px-1">npm run dev</code>):
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <code className="rounded bg-amber-100 px-2 py-2 text-xs text-amber-950">
          npm run scrape:instagram
        </code>
        <code className="rounded bg-amber-100 px-2 py-2 text-xs text-amber-950">
          npm run scrape:tiktok
        </code>
        <code className="rounded bg-amber-100 px-2 py-2 text-xs text-amber-950">
          npm run tiktok:import-apify
        </code>
        <code className="rounded bg-amber-100 px-2 py-2 text-xs text-amber-950">
          npm run cron
        </code>
      </div>
    </div>
  );
}
