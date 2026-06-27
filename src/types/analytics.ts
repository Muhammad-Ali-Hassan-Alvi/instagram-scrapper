export interface AnalyticsFilters {
  platform: string;
  account: string;
  year: string;
  metric: "engagement" | "views" | "likes" | "comments" | "shares";
  page: number;
  pageSize: number;
}

export const DEFAULT_ANALYTICS_FILTERS: AnalyticsFilters = {
  platform: "all",
  account: "all",
  year: "all",
  metric: "engagement",
  page: 1,
  pageSize: 25,
};

export interface PostsPageResult {
  rows: TopPostRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface AnalyticsKpis {
  totalPosts: number;
  totalViews: number;
  totalReach: number | null;
  totalLikes: number;
  totalComments: number;
  totalViewers: number | null;
  totalShares: number;
  totalSaves: number;
  totalEngagement: number;
  totalSpend: number | null;
  totalFollowers: number;
  avgEngagementRate: number;
}

export interface TrendPoint {
  label: string;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  engagement: number;
}

export interface PlatformMetricSlice {
  platform: string;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
}

export interface AccountShareSlice {
  name: string;
  value: number;
  percentage: number;
}

export interface WeeklyCategoryPoint {
  week: string;
  category: string;
  value: number;
}

export interface TopPostRow {
  username: string;
  platform: string;
  shortcode: string;
  type: string;
  postedAt: string;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  engagement: number;
  postUrl: string;
}

export interface AccountAnalyticsSlice {
  platform: string;
  username: string;
  kpis: AnalyticsKpis;
  topPosts: TopPostRow[];
}

export interface AnalyticsSnapshot {
  connected: boolean;
  error?: string;
  filters: AnalyticsFilters;
  kpis: AnalyticsKpis;
  trendByMonth: TrendPoint[];
  platformComparison: PlatformMetricSlice[];
  sharesByAccount: AccountShareSlice[];
  weeklyByCategory: WeeklyCategoryPoint[];
  topPosts: TopPostRow[];
  postsPage: PostsPageResult;
  topPostsByAccount: AccountAnalyticsSlice[];
  availableYears: number[];
  availableAccounts: string[];
  accountSummaries: {
    platform: string;
    username: string;
    followers: number;
    scrapedPosts: number;
    totalPosts: number;
  }[];
  lastDataRefresh: string | null;
  insightsNote: string;
}
