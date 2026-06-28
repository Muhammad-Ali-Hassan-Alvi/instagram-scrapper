import mongoose, { Schema, type Document, type Model } from "mongoose";

export type ApifyScrapeStatus = "idle" | "running" | "success" | "error";
export type ApifyAccountRunStatus = "idle" | "running" | "success" | "error" | "skipped";

export interface ApifyScrapeSummary {
  tiktokPosts: number;
  instagramPosts: number;
  accounts: { platform: string; username: string; posts: number }[];
}

export interface ApifyAccountRun {
  platform: "instagram" | "tiktok";
  username: string;
  status: ApifyAccountRunStatus;
  actorId: string;
  startedAt: Date | null;
  completedAt: Date | null;
  posts: number;
  error: string | null;
  message: string;
}

export interface IApifySettings {
  token: string;
  tokenHint: string;
  apifyUsername: string;
  lastValidatedAt: Date | null;
  scrapeStatus: ApifyScrapeStatus;
  scrapePhase: string;
  scrapeMessage: string;
  lastScrapeAt: Date | null;
  lastScrapeError: string | null;
  lastScrapeSummary: ApifyScrapeSummary | null;
  accountRuns: ApifyAccountRun[];
}

export interface ApifySettingsDocument extends IApifySettings, Document {}

const accountRunSchema = new Schema(
  {
    platform: { type: String, enum: ["instagram", "tiktok"], required: true },
    username: { type: String, required: true },
    status: {
      type: String,
      enum: ["idle", "running", "success", "error", "skipped"],
      default: "idle",
    },
    actorId: { type: String, default: "" },
    startedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    posts: { type: Number, default: 0 },
    error: { type: String, default: null },
    message: { type: String, default: "" },
  },
  { _id: false },
);

const scrapeSummarySchema = new Schema(
  {
    tiktokPosts: { type: Number, default: 0 },
    instagramPosts: { type: Number, default: 0 },
    accounts: [
      {
        platform: String,
        username: String,
        posts: Number,
      },
    ],
  },
  { _id: false },
);

const apifySettingsSchema = new Schema<ApifySettingsDocument>(
  {
    token: { type: String, default: "" },
    tokenHint: { type: String, default: "" },
    apifyUsername: { type: String, default: "" },
    lastValidatedAt: { type: Date, default: null },
    scrapeStatus: {
      type: String,
      enum: ["idle", "running", "success", "error"],
      default: "idle",
    },
    scrapePhase: { type: String, default: "" },
    scrapeMessage: { type: String, default: "" },
    lastScrapeAt: { type: Date, default: null },
    lastScrapeError: { type: String, default: null },
    lastScrapeSummary: { type: scrapeSummarySchema, default: null },
    accountRuns: { type: [accountRunSchema], default: [] },
  },
  { timestamps: true },
);

export const ApifySettings: Model<ApifySettingsDocument> =
  (mongoose.models.ApifySettings as Model<ApifySettingsDocument> | undefined) ??
  mongoose.model<ApifySettingsDocument>("ApifySettings", apifySettingsSchema);
