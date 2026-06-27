import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";

import { DEFAULT_TARGET_ACCOUNTS } from "@/config/accounts";
import { accountKey } from "@/lib/account-route";
import { connectDB } from "@/lib/db";
import { postUrlForPlatform } from "@/lib/format";
import type { PostDocument } from "@/models/Post";
import type { AccountDocument } from "@/models/Account";
import type { ScrapedPost } from "@/scrapers/shared/types";
import { getIsoWeek } from "@/scrapers/instagram/parsers";
import {
  CONSOLIDATED_EXPORT_COLUMNS,
  postEngagement,
  type ConsolidatedExportRow,
} from "@/types/consolidated-export";
import { loadAllPostsForExport } from "@/services/persistence";
import { rowsToCsv } from "@/services/csv-export";

function emptyInsightsFields(): Pick<
  ConsolidatedExportRow,
  | "Reach"
  | "Followers_Reach"
  | "Non_Followers_Reach"
  | "Avg_Watch_Time_sec"
  | "Ad_Spend_USD"
  | "Country"
  | "Gender"
  | "Age_Group"
  | "Total_Viewers"
> {
  return {
    Reach: "",
    Followers_Reach: "",
    Non_Followers_Reach: "",
    Avg_Watch_Time_sec: "",
    Ad_Spend_USD: "",
    Country: "",
    Gender: "",
    Age_Group: "",
    Total_Viewers: "",
  };
}

export function postToConsolidatedRow(
  account: Pick<AccountDocument, "accountId" | "username" | "followers" | "platform">,
  post: Pick<
    PostDocument,
    | "postId"
    | "shortcode"
    | "type"
    | "postedAt"
    | "likes"
    | "comments"
    | "shares"
    | "saves"
    | "views"
    | "duration"
    | "scrapedAt"
  >,
  category: string,
  dataRefresh?: Date,
): ConsolidatedExportRow {
  const postedAt = new Date(post.postedAt);
  const refreshAt = dataRefresh ?? post.scrapedAt ?? new Date();
  const engagement = postEngagement(post);

  return {
    Account: account.username,
    Account_ID: account.accountId,
    Category: category,
    Platform: account.platform,
    Platform_ID: account.accountId,
    Post_ID: post.postId,
    Post_URL: postUrlForPlatform(account.platform, account.username, post.shortcode, post.type),
    Total_Engagement: engagement,
    ...emptyInsightsFields(),
    Views: post.views,
    Likes: post.likes,
    Comments: post.comments,
    Shares: post.shares,
    Saves: post.saves,
    Video_Duration_sec: post.duration ?? "",
    Current_Followers: account.followers,
    Post_Date: postedAt.toISOString(),
    Post_Year: postedAt.getUTCFullYear(),
    Post_Month: postedAt.getUTCMonth() + 1,
    Post_Week: getIsoWeek(postedAt),
    Post_Day: postedAt.getUTCDate(),
    Data_Refresh: new Date(refreshAt).toISOString(),
  };
}

export function scrapedPostToConsolidatedRow(
  post: ScrapedPost,
  followers: number,
  dataRefresh: Date,
): ConsolidatedExportRow {
  return postToConsolidatedRow(
    {
      accountId: post.accountId,
      username: post.accountUsername,
      followers,
      platform: post.platform,
    },
    {
      postId: post.postId,
      shortcode: post.shortcode,
      type: post.type,
      postedAt: post.postedAt,
      likes: post.likes,
      comments: post.comments,
      shares: post.shares,
      saves: post.saves,
      views: post.views,
      duration: post.duration,
      scrapedAt: dataRefresh,
    },
    post.category,
    dataRefresh,
  );
}

function sortRowsByEngagement(rows: ConsolidatedExportRow[]): ConsolidatedExportRow[] {
  return [...rows].sort((a, b) => {
    const accountCompare = String(a.Account).localeCompare(String(b.Account));
    if (accountCompare !== 0) return accountCompare;
    return Number(b.Total_Engagement) - Number(a.Total_Engagement);
  });
}

export async function buildConsolidatedExportRows(
  dataRefresh = new Date(),
  accountUsername?: string,
  accountPlatform?: string,
): Promise<ConsolidatedExportRow[]> {
  await connectDB();

  const grouped = await loadAllPostsForExport();
  const categoryByTarget = new Map(
    DEFAULT_TARGET_ACCOUNTS.map((target) => [
      accountKey(target.platform, target.username),
      target.category ?? "",
    ]),
  );

  const rows: ConsolidatedExportRow[] = [];

  for (const { account, posts } of grouped) {
    if (accountUsername && account.username !== accountUsername) continue;
    if (accountPlatform && account.platform !== accountPlatform) continue;

    const category =
      categoryByTarget.get(accountKey(account.platform, account.username)) ?? "";

    for (const post of posts) {
      rows.push(postToConsolidatedRow(account, post, category, dataRefresh));
    }
  }

  return sortRowsByEngagement(rows);
}

export async function writePerAccountExportFiles(dataRefresh = new Date()): Promise<string[]> {
  const outDir = join(process.cwd(), "data", "accounts");
  mkdirSync(outDir, { recursive: true });

  const written: string[] = [];
  for (const target of DEFAULT_TARGET_ACCOUNTS) {
    const rows = await buildConsolidatedExportRows(
      dataRefresh,
      target.username,
      target.platform,
    );
    if (!rows.length) continue;
    const path = join(outDir, `${target.platform}-${target.username}.csv`);
    writeFileSync(path, rowsToCsv(rows), "utf8");
    written.push(path);
  }
  return written;
}

export function rowToOrderedValues(row: ConsolidatedExportRow): (string | number)[] {
  return CONSOLIDATED_EXPORT_COLUMNS.map((column) => row[column] ?? "");
}

export interface ExportDatasetMeta {
  rowCount: number;
  accountCount: number;
  lastDataRefresh: string | null;
  platforms: string[];
  accounts: { username: string; rowCount: number }[];
}

export function summarizeExportRows(rows: ConsolidatedExportRow[]): ExportDatasetMeta {
  const accountIds = new Set(rows.map((row) => String(row.Account_ID)));
  const platforms = [...new Set(rows.map((row) => String(row.Platform)))];
  const refreshes = rows
    .map((row) => String(row.Data_Refresh))
    .filter(Boolean)
    .sort();

  const accountCounts = new Map<string, number>();
  for (const row of rows) {
    const account = String(row.Account);
    accountCounts.set(account, (accountCounts.get(account) ?? 0) + 1);
  }

  return {
    rowCount: rows.length,
    accountCount: accountIds.size,
    lastDataRefresh: refreshes.at(-1) ?? null,
    platforms,
    accounts: [...accountCounts.entries()].map(([username, rowCount]) => ({
      username,
      rowCount,
    })),
  };
}
