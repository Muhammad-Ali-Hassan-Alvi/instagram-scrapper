import mongoose, { Schema, type Document, type Model } from "mongoose";

import type { Platform } from "@/types";

export interface IScrapeLog {
  platform: Platform;
  username: string;
  startedAt: Date;
  completedAt: Date | null;
  durationMs: number | null;
  success: boolean;
  pagesScraped: number;
  postsInserted: number;
  postsUpdated: number;
  errorMessage: string | null;
}

export interface ScrapeLogDocument extends IScrapeLog, Document {}

const scrapeLogSchema = new Schema<ScrapeLogDocument>(
  {
    platform: {
      type: String,
      enum: ["instagram", "tiktok"],
      required: true,
    },
    username: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    startedAt: {
      type: Date,
      required: true,
      default: () => new Date(),
    },
    completedAt: {
      type: Date,
      default: null,
    },
    durationMs: {
      type: Number,
      default: null,
      min: 0,
    },
    success: {
      type: Boolean,
      default: false,
    },
    pagesScraped: {
      type: Number,
      default: 0,
      min: 0,
    },
    postsInserted: {
      type: Number,
      default: 0,
      min: 0,
    },
    postsUpdated: {
      type: Number,
      default: 0,
      min: 0,
    },
    errorMessage: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

// TODO: Add reference to Account once scrape orchestration links logs to accounts.

export const ScrapeLog: Model<ScrapeLogDocument> =
  (mongoose.models.ScrapeLog as Model<ScrapeLogDocument> | undefined) ??
  mongoose.model<ScrapeLogDocument>("ScrapeLog", scrapeLogSchema);
