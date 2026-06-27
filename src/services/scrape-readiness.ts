import { DEFAULT_TARGET_ACCOUNTS } from "@/config/accounts";
import { getEnv } from "@/config/env";
import { connectDB } from "@/lib/db";
import { Account } from "@/models/Account";
import { Post } from "@/models/Post";

export interface AccountReadiness {
  username: string;
  scrapedPosts: number;
  totalPosts: number;
  lastScrapedAt: string | null;
  complete: boolean;
}

export interface DataReadiness {
  ready: boolean;
  stale: boolean;
  needsScrape: boolean;
  accounts: AccountReadiness[];
  reason: string | null;
}

function staleAfterMs(): number {
  const hours = getEnv().SCRAPE_STALE_HOURS;
  return hours * 60 * 60 * 1000;
}

export async function getDataReadiness(): Promise<DataReadiness> {
  const targets = DEFAULT_TARGET_ACCOUNTS.filter((account) => account.platform === "instagram");
  const usernames = targets.map((target) => target.username);

  try {
    await connectDB();
  } catch {
    return {
      ready: false,
      stale: true,
      needsScrape: true,
      accounts: usernames.map((username) => ({
        username,
        scrapedPosts: 0,
        totalPosts: 0,
        lastScrapedAt: null,
        complete: false,
      })),
      reason: "Database unavailable",
    };
  }

  const accountDocs = await Account.find({ username: { $in: usernames } }).lean();
  const postCounts = await Post.aggregate<{ _id: unknown; count: number }>([
    { $group: { _id: "$accountId", count: { $sum: 1 } } },
  ]);

  const postCountByAccountId = new Map(
    postCounts.map((row) => [String(row._id), row.count]),
  );

  const now = Date.now();
  const accounts: AccountReadiness[] = targets.map((target) => {
    const doc = accountDocs.find((account) => account.username === target.username);
    const scrapedPosts = doc ? (postCountByAccountId.get(String(doc._id)) ?? 0) : 0;
    const totalPosts = doc?.totalPosts ?? 0;
    const complete =
      Boolean(doc) &&
      scrapedPosts > 0 &&
      (totalPosts === 0 || scrapedPosts >= totalPosts);

    return {
      username: target.username,
      scrapedPosts,
      totalPosts,
      lastScrapedAt: doc?.lastScrapedAt?.toISOString() ?? null,
      complete,
    };
  });

  const allComplete = accounts.every((account) => account.complete);
  const latestRefresh = accounts
    .map((account) => account.lastScrapedAt)
    .filter(Boolean)
    .sort()
    .at(-1);

  const stale =
    !latestRefresh || now - new Date(latestRefresh).getTime() > staleAfterMs();

  const ready = allComplete && !stale;
  const needsScrape = !allComplete || stale;

  let reason: string | null = null;
  if (!allComplete) {
    const incomplete = accounts.filter((account) => !account.complete);
    reason = incomplete
      .map(
        (account) =>
          `@${account.username}: ${account.scrapedPosts}/${account.totalPosts || "?"} posts`,
      )
      .join(", ");
  } else if (stale) {
    reason = "Data is older than refresh window";
  }

  return {
    ready,
    stale,
    needsScrape,
    accounts,
    reason,
  };
}
