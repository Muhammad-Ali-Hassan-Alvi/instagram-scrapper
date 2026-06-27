import { DEFAULT_TARGET_ACCOUNTS } from "@/config/accounts";
import { accountKey, parseAccountKey } from "@/lib/account-route";
import { connectDB } from "@/lib/db";
import { postUrlForPlatform } from "@/lib/format";
import { Account } from "@/models/Account";
import { Post } from "@/models/Post";
import type { Platform } from "@/types";
import {
  DEFAULT_ANALYTICS_FILTERS,
  type AnalyticsFilters,
  type AnalyticsKpis,
  type AnalyticsSnapshot,
  type PlatformMetricSlice,
  type TopPostRow,
  type TrendPoint,
  type AccountAnalyticsSlice,
  type PostsPageResult,
} from "@/types/analytics";
import { postEngagement } from "@/types/consolidated-export";

function parseFilters(searchParams: Record<string, string | undefined>): AnalyticsFilters {
  const metric = searchParams.metric;
  const validMetrics = ["engagement", "views", "likes", "comments", "shares"] as const;
  const page = Math.max(1, Number(searchParams.page) || DEFAULT_ANALYTICS_FILTERS.page);
  const rawPageSize = searchParams.pageSize;
  const pageSize =
    rawPageSize === "all"
      ? 100_000
      : Math.min(100_000, Math.max(10, Number(rawPageSize) || DEFAULT_ANALYTICS_FILTERS.pageSize));

  return {
    platform: searchParams.platform ?? DEFAULT_ANALYTICS_FILTERS.platform,
    account: searchParams.account ?? DEFAULT_ANALYTICS_FILTERS.account,
    year: searchParams.year ?? DEFAULT_ANALYTICS_FILTERS.year,
    metric: validMetrics.includes(metric as (typeof validMetrics)[number])
      ? (metric as AnalyticsFilters["metric"])
      : DEFAULT_ANALYTICS_FILTERS.metric,
    page,
    pageSize,
  };
}

function mapPostRow(post: {
  platform?: string;
  account?: { username?: string; platform?: string };
  shortcode?: string;
  type?: string;
  postedAt: Date | string;
  views?: number;
  likes?: number;
  comments?: number;
  shares?: number;
  saves?: number;
  engagement?: number;
}): TopPostRow {
  const platform = post.account?.platform ?? post.platform ?? "instagram";
  const username = post.account?.username ?? "unknown";

  return {
    platform,
    username,
    shortcode: post.shortcode ?? "",
    type: post.type ?? "",
    postedAt: new Date(post.postedAt).toISOString(),
    views: post.views ?? 0,
    likes: post.likes ?? 0,
    comments: post.comments ?? 0,
    shares: post.shares ?? 0,
    saves: post.saves ?? 0,
    engagement:
      post.engagement ??
      postEngagement({
        likes: post.likes ?? 0,
        comments: post.comments ?? 0,
        shares: post.shares ?? 0,
        saves: post.saves ?? 0,
      }),
    postUrl: postUrlForPlatform(platform, username, post.shortcode ?? "", post.type ?? ""),
  };
}

function sortFieldForMetric(metric: AnalyticsFilters["metric"]): string {
  return metric === "engagement" ? "engagement" : metric;
}

function emptySnapshot(filters: AnalyticsFilters, error?: string): AnalyticsSnapshot {
  return {
    connected: false,
    error,
    filters,
    kpis: {
      totalPosts: 0,
      totalViews: 0,
      totalReach: null,
      totalLikes: 0,
      totalComments: 0,
      totalViewers: null,
      totalShares: 0,
      totalSaves: 0,
      totalEngagement: 0,
      totalSpend: null,
      totalFollowers: 0,
      avgEngagementRate: 0,
    },
    trendByMonth: [],
    platformComparison: [],
    sharesByAccount: [],
    weeklyByCategory: [],
    topPosts: [],
    postsPage: { rows: [], total: 0, page: 1, pageSize: 25, totalPages: 0 },
    topPostsByAccount: [],
    availableYears: [],
    availableAccounts: DEFAULT_TARGET_ACCOUNTS.map((account) =>
      accountKey(account.platform, account.username),
    ),
    accountSummaries: [],
    lastDataRefresh: null,
    insightsNote:
      "Reach, viewers, demographics, and ad spend are owner-insights only — not available from public scraping.",
  };
}

async function buildPostMatch(filters: AnalyticsFilters): Promise<Record<string, unknown>> {
  const match: Record<string, unknown> = {};

  if (filters.platform !== "all") {
    match.platform = filters.platform;
  }

  if (filters.year !== "all") {
    const year = Number(filters.year);
    match.postedAt = {
      $gte: new Date(`${year}-01-01T00:00:00.000Z`),
      $lt: new Date(`${year + 1}-01-01T00:00:00.000Z`),
    };
  }

  if (filters.account !== "all") {
    const parsed = parseAccountKey(filters.account);
    const account = await Account.findOne(
      parsed
        ? { username: parsed.username, platform: parsed.platform as Platform }
        : { username: filters.account.toLowerCase() },
    )
      .select("_id")
      .lean();
    if (account) {
      match.accountId = account._id;
    } else {
      match.accountId = null;
    }
  }

  return match;
}

export async function getAnalyticsSnapshot(
  searchParams: Record<string, string | undefined> = {},
): Promise<AnalyticsSnapshot> {
  const filters = parseFilters(searchParams);

  try {
    await connectDB();
  } catch (error) {
    return emptySnapshot(
      filters,
      error instanceof Error ? error.message : "Database connection failed",
    );
  }

  try {
    const match = await buildPostMatch(filters);
    const categoryByTarget = new Map(
      DEFAULT_TARGET_ACCOUNTS.map((target) => [
        accountKey(target.platform, target.username),
        target.category ?? "Other",
      ]),
    );

    const [totals] = await Post.aggregate<{
      count: number;
      views: number;
      likes: number;
      comments: number;
      shares: number;
      saves: number;
    }>([
      { $match: match },
      {
        $group: {
          _id: null,
          count: { $sum: 1 },
          views: { $sum: "$views" },
          likes: { $sum: "$likes" },
          comments: { $sum: "$comments" },
          shares: { $sum: "$shares" },
          saves: { $sum: "$saves" },
        },
      },
    ]);

    const summary = totals ?? {
      count: 0,
      views: 0,
      likes: 0,
      comments: 0,
      shares: 0,
      saves: 0,
    };

    const engagement = summary.likes + summary.comments + summary.shares + summary.saves;
    const avgEngagementRate =
      summary.views > 0 ? Number(((engagement / summary.views) * 100).toFixed(1)) : 0;

    const accountQuery: { platform?: Platform } =
      filters.platform === "all" ? {} : { platform: filters.platform as Platform };
    const accounts = await Account.find(accountQuery).lean();
    const totalFollowers = accounts.reduce((sum, account) => sum + account.followers, 0);

    const trendByMonth = await Post.aggregate<TrendPoint>([
      { $match: match },
      {
        $group: {
          _id: {
            year: { $year: "$postedAt" },
            month: { $month: "$postedAt" },
          },
          views: { $sum: "$views" },
          likes: { $sum: "$likes" },
          comments: { $sum: "$comments" },
          shares: { $sum: "$shares" },
        },
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } },
      {
        $project: {
          _id: 0,
          label: {
            $concat: [
              { $toString: "$_id.year" },
              "-",
              {
                $cond: [
                  { $lt: ["$_id.month", 10] },
                  { $concat: ["0", { $toString: "$_id.month" }] },
                  { $toString: "$_id.month" },
                ],
              },
            ],
          },
          views: 1,
          likes: 1,
          comments: 1,
          shares: 1,
          engagement: { $add: ["$likes", "$comments", "$shares", "$saves"] },
        },
      },
    ]);

    const platformComparison = await Post.aggregate<PlatformMetricSlice>([
      { $match: match },
      {
        $group: {
          _id: "$platform",
          likes: { $sum: "$likes" },
          comments: { $sum: "$comments" },
          shares: { $sum: "$shares" },
          saves: { $sum: "$saves" },
        },
      },
      {
        $project: {
          _id: 0,
          platform: "$_id",
          likes: 1,
          comments: 1,
          shares: 1,
          saves: 1,
        },
      },
    ]);

    const engagementByAccountRaw = await Post.aggregate<{
      platform: string;
      username: string;
      engagement: number;
    }>([
      { $match: match },
      {
        $lookup: {
          from: "accounts",
          localField: "accountId",
          foreignField: "_id",
          as: "account",
        },
      },
      { $unwind: "$account" },
      {
        $group: {
          _id: {
            platform: "$account.platform",
            username: "$account.username",
          },
          engagement: {
            $sum: { $add: ["$likes", "$comments", "$shares", "$saves"] },
          },
        },
      },
      {
        $project: {
          _id: 0,
          platform: "$_id.platform",
          username: "$_id.username",
          engagement: 1,
        },
      },
    ]);

    const totalEngagementForPct =
      engagementByAccountRaw.reduce((sum, row) => sum + row.engagement, 0) || 1;
    const sharesByAccount = engagementByAccountRaw.map((row) => ({
      name: accountKey(row.platform, row.username),
      value: row.engagement,
      percentage: Number(((row.engagement / totalEngagementForPct) * 100).toFixed(1)),
    }));

    const metricSumExpression =
      filters.metric === "engagement"
        ? { $add: ["$likes", "$comments", "$shares", "$saves"] }
        : `$${filters.metric}`;

    const weeklyRaw = await Post.aggregate<{
      week: number;
      year: number;
      platform: string;
      username: string;
      value: number;
    }>([
      { $match: match },
      {
        $lookup: {
          from: "accounts",
          localField: "accountId",
          foreignField: "_id",
          as: "account",
        },
      },
      { $unwind: "$account" },
      {
        $group: {
          _id: {
            year: { $isoWeekYear: "$postedAt" },
            week: { $isoWeek: "$postedAt" },
            platform: "$account.platform",
            username: "$account.username",
          },
          value: { $sum: metricSumExpression },
        },
      },
      {
        $project: {
          _id: 0,
          year: "$_id.year",
          week: "$_id.week",
          platform: "$_id.platform",
          username: "$_id.username",
          value: 1,
        },
      },
      { $sort: { year: 1, week: 1 } },
      { $limit: 52 },
    ]);

    const weeklyByCategory = weeklyRaw.map((row) => ({
      week: `W${row.week}`,
      category:
        categoryByTarget.get(accountKey(row.platform, row.username)) ??
        accountKey(row.platform, row.username),
      value: row.value,
    }));

    async function fetchTopPosts(
      postMatch: Record<string, unknown>,
      metric: AnalyticsFilters["metric"],
      limit = 10,
    ): Promise<TopPostRow[]> {
      const sortField = sortFieldForMetric(metric);
      const raw = await Post.aggregate([
        { $match: postMatch },
        {
          $lookup: {
            from: "accounts",
            localField: "accountId",
            foreignField: "_id",
            as: "account",
          },
        },
        { $unwind: "$account" },
        {
          $addFields: {
            engagement: { $add: ["$likes", "$comments", "$shares", "$saves"] },
          },
        },
        { $sort: { [sortField]: -1, postedAt: -1 } },
        { $limit: limit },
      ]);

      return raw.map((post) => mapPostRow(post));
    }

    async function fetchPostsPage(
      postMatch: Record<string, unknown>,
      metric: AnalyticsFilters["metric"],
      page: number,
      pageSize: number,
    ): Promise<PostsPageResult> {
      const sortField = sortFieldForMetric(metric);
      const skip = (page - 1) * pageSize;

      const [result] = await Post.aggregate<{
        metadata: { total: number }[];
        rows: Parameters<typeof mapPostRow>[0][];
      }>([
        { $match: postMatch },
        {
          $lookup: {
            from: "accounts",
            localField: "accountId",
            foreignField: "_id",
            as: "account",
          },
        },
        { $unwind: "$account" },
        {
          $addFields: {
            engagement: { $add: ["$likes", "$comments", "$shares", "$saves"] },
          },
        },
        { $sort: { [sortField]: -1, postedAt: -1 } },
        {
          $facet: {
            metadata: [{ $count: "total" }],
            rows: [{ $skip: skip }, { $limit: pageSize }],
          },
        },
      ]);

      const total = result?.metadata[0]?.total ?? 0;
      const effectivePageSize = Math.min(pageSize, Math.max(total, 1));
      const totalPages = total > 0 ? Math.ceil(total / effectivePageSize) : 0;

      return {
        rows: (result?.rows ?? []).map((post) => mapPostRow(post)),
        total,
        page,
        pageSize: effectivePageSize,
        totalPages,
      };
    }

    const topPosts = await fetchTopPosts(match, filters.metric, 10);
    const postsPage = await fetchPostsPage(match, filters.metric, filters.page, filters.pageSize);

    const topPostsByAccount: AccountAnalyticsSlice[] = [];
    if (filters.account === "all") {
      for (const target of DEFAULT_TARGET_ACCOUNTS) {
        const accountMatch = { ...match };
        const accountDoc = await Account.findOne({
          username: target.username,
          platform: target.platform,
        })
          .select("_id")
          .lean();
        if (!accountDoc) continue;
        accountMatch.accountId = accountDoc._id;

        const [acctTotals] = await Post.aggregate([
          { $match: accountMatch },
          {
            $group: {
              _id: null,
              count: { $sum: 1 },
              views: { $sum: "$views" },
              likes: { $sum: "$likes" },
              comments: { $sum: "$comments" },
              shares: { $sum: "$shares" },
              saves: { $sum: "$saves" },
            },
          },
        ]);

        const acctSummary = acctTotals ?? {
          count: 0,
          views: 0,
          likes: 0,
          comments: 0,
          shares: 0,
          saves: 0,
        };
        const acctEngagement =
          acctSummary.likes + acctSummary.comments + acctSummary.shares + acctSummary.saves;
        const acctAccount = accounts.find(
          (account) =>
            account.username === target.username && account.platform === target.platform,
        );

        topPostsByAccount.push({
          platform: target.platform,
          username: target.username,
          kpis: {
            totalPosts: acctSummary.count,
            totalViews: acctSummary.views,
            totalReach: null,
            totalLikes: acctSummary.likes,
            totalComments: acctSummary.comments,
            totalViewers: null,
            totalShares: acctSummary.shares,
            totalSaves: acctSummary.saves,
            totalEngagement: acctEngagement,
            totalSpend: null,
            totalFollowers: acctAccount?.followers ?? 0,
            avgEngagementRate:
              acctSummary.views > 0
                ? Number(((acctEngagement / acctSummary.views) * 100).toFixed(1))
                : 0,
          },
          topPosts: await fetchTopPosts(accountMatch, filters.metric, 10),
        });
      }
    }

    const yearsRaw = await Post.aggregate<{ _id: number }>([
      { $project: { year: { $year: "$postedAt" } } },
      { $group: { _id: "$year" } },
      { $sort: { _id: -1 } },
    ]);

    const postCounts = await Post.aggregate<{ _id: unknown; count: number }>([
      { $match: match },
      { $group: { _id: "$accountId", count: { $sum: 1 } } },
    ]);
    const postCountByAccount = new Map(
      postCounts.map((entry) => [String(entry._id), entry.count]),
    );

    const accountSummaries = accounts.map((account) => ({
      platform: account.platform,
      username: account.username,
      followers: account.followers,
      scrapedPosts: postCountByAccount.get(String(account._id)) ?? 0,
      totalPosts: Math.max(account.totalPosts, postCountByAccount.get(String(account._id)) ?? 0),
    }));

    const kpis: AnalyticsKpis = {
      totalPosts: summary.count,
      totalViews: summary.views,
      totalReach: null,
      totalLikes: summary.likes,
      totalComments: summary.comments,
      totalViewers: null,
      totalShares: summary.shares,
      totalSaves: summary.saves,
      totalEngagement: engagement,
      totalSpend: null,
      totalFollowers,
      avgEngagementRate,
    };

    const lastDataRefresh =
      accounts
        .map((account) => account.lastScrapedAt)
        .filter((value): value is Date => value instanceof Date)
        .sort((a, b) => b.getTime() - a.getTime())[0]
        ?.toISOString() ?? null;

    return {
      connected: true,
      filters,
      kpis,
      trendByMonth,
      platformComparison,
      sharesByAccount,
      weeklyByCategory,
      topPosts,
      postsPage,
      topPostsByAccount,
      availableYears: yearsRaw.map((y) => y._id),
      availableAccounts: DEFAULT_TARGET_ACCOUNTS.map((account) =>
        accountKey(account.platform, account.username),
      ),
      accountSummaries,
      lastDataRefresh,
      insightsNote:
        "Reach, viewers, demographics, and ad spend are owner-insights only — not available from public scraping.",
    };
  } catch (error) {
    return emptySnapshot(
      filters,
      error instanceof Error ? error.message : "Failed to load analytics",
    );
  }
}

export function filtersToSearchParams(filters: AnalyticsFilters): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.platform !== "all") params.set("platform", filters.platform);
  if (filters.account !== "all") params.set("account", filters.account);
  if (filters.year !== "all") params.set("year", filters.year);
  if (filters.metric !== "engagement") params.set("metric", filters.metric);
  return params;
}
