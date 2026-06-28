import { connectDB } from "@/lib/db";
import { Account } from "@/models/Account";
import { Post } from "@/models/Post";
import { ScrapeLog } from "@/models/ScrapeLog";
import { getDataReadiness } from "@/services/scrape-readiness";

async function main(): Promise<void> {
  await connectDB();

  const readiness = await getDataReadiness();
  console.log("\n=== Data readiness ===");
  console.log(JSON.stringify(readiness, null, 2));

  const accounts = await Account.find().sort({ platform: 1, username: 1 }).lean();
  const postCounts = await Post.aggregate<{ _id: unknown; count: number; lastScraped: Date }>([
    { $group: { _id: "$accountId", count: { $sum: 1 }, lastScraped: { $max: "$scrapedAt" } } },
  ]);
  const countById = new Map(postCounts.map((row) => [String(row._id), row]));

  console.log("\n=== All accounts ===");
  for (const account of accounts) {
    const stats = countById.get(String(account._id));
    console.log(
      JSON.stringify({
        platform: account.platform,
        username: account.username,
        followers: account.followers,
        totalPosts: account.totalPosts,
        postsInDb: stats?.count ?? 0,
        lastScrapedAt: account.lastScrapedAt?.toISOString() ?? null,
        lastPostSaved: stats?.lastScraped?.toISOString() ?? null,
      }),
    );
  }

  const logs = await ScrapeLog.find().sort({ startedAt: -1 }).limit(8).lean();
  console.log("\n=== Recent scrape logs ===");
  for (const log of logs) {
    console.log(
      JSON.stringify({
        platform: log.platform,
        username: log.username,
        startedAt: log.startedAt,
        success: log.success,
        inserted: log.postsInserted,
        updated: log.postsUpdated,
        error: log.errorMessage,
      }),
    );
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
