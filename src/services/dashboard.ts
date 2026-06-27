import { DEFAULT_TARGET_ACCOUNTS } from "@/config/accounts";
import { accountKey } from "@/lib/account-route";
import { connectDB } from "@/lib/db";
import { postUrlForPlatform } from "@/lib/format";
import { Account } from "@/models/Account";
import { Post } from "@/models/Post";
import { ScrapeLog } from "@/models/ScrapeLog";

export interface DashboardAccount {
  username: string;
  platform: string;
  displayName: string;
  followers: number;
  totalPosts: number;
  scrapedPosts: number;
  verified: boolean;
  lastScrapedAt: Date | null;
  category: string;
}

export interface DashboardPost {
  id: string;
  username: string;
  shortcode: string;
  type: string;
  postedAt: Date;
  likes: number;
  comments: number;
  views: number;
  shares: number;
  postUrl: string;
}

export interface DashboardScrapeRun {
  username: string;
  success: boolean;
  startedAt: Date;
  completedAt: Date | null;
  postsInserted: number;
  postsUpdated: number;
  errorMessage: string | null;
}

export interface DashboardData {
  connected: boolean;
  error?: string;
  stats: {
    totalPosts: number;
    totalViews: number;
    totalLikes: number;
    totalComments: number;
    accountCount: number;
    lastRefresh: Date | null;
  };
  accounts: DashboardAccount[];
  recentPosts: DashboardPost[];
  recentScrapes: DashboardScrapeRun[];
}

const EMPTY_DASHBOARD: DashboardData = {
  connected: false,
  stats: {
    totalPosts: 0,
    totalViews: 0,
    totalLikes: 0,
    totalComments: 0,
    accountCount: 0,
    lastRefresh: null,
  },
  accounts: [],
  recentPosts: [],
  recentScrapes: [],
};

export async function getDashboardData(): Promise<DashboardData> {
  try {
    await connectDB();
  } catch (error) {
    return {
      ...EMPTY_DASHBOARD,
      error: error instanceof Error ? error.message : "Database connection failed",
    };
  }

  try {
    const accounts = await Account.find().sort({ username: 1 }).lean();
    const postCounts = await Post.aggregate<{ _id: unknown; count: number }>([
      { $group: { _id: "$accountId", count: { $sum: 1 } } },
    ]);
    const postCountByAccount = new Map(
      postCounts.map((entry) => [String(entry._id), entry.count]),
    );

    const totals = await Post.aggregate<{
      views: number;
      likes: number;
      comments: number;
      count: number;
      lastRefresh: Date | null;
    }>([
      {
        $group: {
          _id: null,
          views: { $sum: "$views" },
          likes: { $sum: "$likes" },
          comments: { $sum: "$comments" },
          count: { $sum: 1 },
          lastRefresh: { $max: "$scrapedAt" },
        },
      },
    ]);

    const summary = totals[0] ?? {
      views: 0,
      likes: 0,
      comments: 0,
      count: 0,
      lastRefresh: null,
    };

    const categoryByTarget = new Map(
      DEFAULT_TARGET_ACCOUNTS.map((target) => [
        accountKey(target.platform, target.username),
        target.category ?? "",
      ]),
    );

    const dashboardAccounts: DashboardAccount[] = accounts.map((account) => ({
      username: account.username,
      platform: account.platform,
      displayName: account.displayName,
      followers: account.followers,
      totalPosts: Math.max(account.totalPosts, postCountByAccount.get(String(account._id)) ?? 0),
      scrapedPosts: postCountByAccount.get(String(account._id)) ?? 0,
      verified: account.verified,
      lastScrapedAt: account.lastScrapedAt,
      category: categoryByTarget.get(accountKey(account.platform, account.username)) ?? "",
    }));

    const recentPostsRaw = await Post.find()
      .sort({ postedAt: -1 })
      .limit(15)
      .populate<{ accountId: { username: string; platform: string } | null }>(
        "accountId",
        "username platform",
      )
      .lean();

    const recentPosts: DashboardPost[] = recentPostsRaw.map((post) => {
      const account =
        post.accountId && typeof post.accountId === "object" && "username" in post.accountId
          ? post.accountId
          : null;

      return {
        id: String(post._id),
        username: account?.username ?? "unknown",
        shortcode: post.shortcode,
        type: post.type,
        postedAt: post.postedAt,
        likes: post.likes,
        comments: post.comments,
        views: post.views,
        shares: post.shares,
        postUrl: postUrlForPlatform(
          post.platform ?? account?.platform ?? "instagram",
          account?.username ?? "",
          post.shortcode,
          post.type,
        ),
      };
    });

    const recentScrapesRaw = await ScrapeLog.find()
      .sort({ startedAt: -1 })
      .limit(6)
      .lean();

    const recentScrapes: DashboardScrapeRun[] = recentScrapesRaw.map((log) => ({
      username: log.username,
      success: log.success,
      startedAt: log.startedAt,
      completedAt: log.completedAt,
      postsInserted: log.postsInserted,
      postsUpdated: log.postsUpdated,
      errorMessage: log.errorMessage,
    }));

    return {
      connected: true,
      stats: {
        totalPosts: summary.count,
        totalViews: summary.views,
        totalLikes: summary.likes,
        totalComments: summary.comments,
        accountCount: accounts.length,
        lastRefresh: summary.lastRefresh,
      },
      accounts: dashboardAccounts,
      recentPosts,
      recentScrapes,
    };
  } catch (error) {
    return {
      ...EMPTY_DASHBOARD,
      connected: false,
      error: error instanceof Error ? error.message : "Failed to load dashboard data",
    };
  }
}
