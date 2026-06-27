/** Consolidated dataset columns — spec fields + Account, Post_URL, Total_Engagement. */
export const CONSOLIDATED_EXPORT_COLUMNS = [
  "Account",
  "Account_ID",
  "Category",
  "Platform",
  "Platform_ID",
  "Post_ID",
  "Post_URL",
  "Total_Engagement",
  "Reach",
  "Followers_Reach",
  "Non_Followers_Reach",
  "Views",
  "Likes",
  "Comments",
  "Shares",
  "Saves",
  "Video_Duration_sec",
  "Avg_Watch_Time_sec",
  "Ad_Spend_USD",
  "Current_Followers",
  "Post_Date",
  "Post_Year",
  "Post_Month",
  "Post_Week",
  "Post_Day",
  "Country",
  "Gender",
  "Age_Group",
  "Total_Viewers",
  "Data_Refresh",
] as const;

export type ConsolidatedExportColumn = (typeof CONSOLIDATED_EXPORT_COLUMNS)[number];

export type ConsolidatedExportRow = Record<ConsolidatedExportColumn, string | number>;

export type ExportFormat = "csv" | "pdf" | "docx" | "html";

export const EXPORT_FORMAT_LABELS: Record<ExportFormat, string> = {
  csv: "CSV",
  pdf: "PDF",
  docx: "Word (.docx)",
  html: "HTML Table",
};

export function postEngagement(values: {
  likes: number;
  comments: number;
  shares: number;
  saves: number;
}): number {
  return values.likes + values.comments + values.shares + values.saves;
}
