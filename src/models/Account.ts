import mongoose, { Schema, type Document, type Model } from "mongoose";

import type { Platform } from "@/types";

export interface IAccount {
  platform: Platform;
  username: string;
  displayName: string;
  accountId: string;
  profileImage: string;
  followers: number;
  following: number;
  totalPosts: number;
  biography: string;
  verified: boolean;
  private: boolean;
  lastScrapedAt: Date | null;
}

export interface AccountDocument extends IAccount, Document {}

const accountSchema = new Schema<AccountDocument>(
  {
    platform: {
      type: String,
      enum: ["instagram", "tiktok"],
      required: true,
    },
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    displayName: {
      type: String,
      default: "",
      trim: true,
    },
    accountId: {
      type: String,
      required: true,
      trim: true,
    },
    profileImage: {
      type: String,
      default: "",
    },
    followers: {
      type: Number,
      default: 0,
      min: 0,
    },
    following: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalPosts: {
      type: Number,
      default: 0,
      min: 0,
    },
    biography: {
      type: String,
      default: "",
    },
    verified: {
      type: Boolean,
      default: false,
    },
    private: {
      type: Boolean,
      default: false,
    },
    lastScrapedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

// TODO: Add virtual populate for posts once Post queries are implemented.

export const Account: Model<AccountDocument> =
  (mongoose.models.Account as Model<AccountDocument> | undefined) ??
  mongoose.model<AccountDocument>("Account", accountSchema);
