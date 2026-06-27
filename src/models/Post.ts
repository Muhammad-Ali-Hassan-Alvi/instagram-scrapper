import mongoose, { Schema, type Document, type Model, type Types } from "mongoose";

import type { Platform } from "@/types";

export enum PostType {
  Image = "image",
  Reel = "reel",
  Carousel = "carousel",
  Video = "video",
}

export interface IPost {
  accountId: Types.ObjectId;
  platform: Platform;
  postId: string;
  shortcode: string;
  type: PostType;
  caption: string;
  hashtags: string[];
  mentions: string[];
  mediaUrl: string;
  thumbnailUrl: string;
  postedAt: Date;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  views: number;
  duration: number | null;
  scrapedAt: Date;
}

export interface PostDocument extends IPost, Document {}

const postSchema = new Schema<PostDocument>(
  {
    accountId: {
      type: Schema.Types.ObjectId,
      ref: "Account",
      required: true,
      index: true,
    },
    platform: {
      type: String,
      enum: ["instagram", "tiktok"],
      required: true,
    },
    postId: {
      type: String,
      required: true,
      trim: true,
    },
    shortcode: {
      type: String,
      default: "",
      trim: true,
    },
    type: {
      type: String,
      enum: Object.values(PostType),
      required: true,
    },
    caption: {
      type: String,
      default: "",
    },
    hashtags: {
      type: [String],
      default: [],
    },
    mentions: {
      type: [String],
      default: [],
    },
    mediaUrl: {
      type: String,
      default: "",
    },
    thumbnailUrl: {
      type: String,
      default: "",
    },
    postedAt: {
      type: Date,
      required: true,
    },
    likes: {
      type: Number,
      default: 0,
      min: 0,
    },
    comments: {
      type: Number,
      default: 0,
      min: 0,
    },
    shares: {
      type: Number,
      default: 0,
      min: 0,
    },
    saves: {
      type: Number,
      default: 0,
      min: 0,
    },
    views: {
      type: Number,
      default: 0,
      min: 0,
    },
    duration: {
      type: Number,
      default: null,
      min: 0,
    },
    scrapedAt: {
      type: Date,
      required: true,
      default: () => new Date(),
    },
  },
  {
    timestamps: { createdAt: false, updatedAt: true },
  },
);

postSchema.index({ accountId: 1, postId: 1 }, { unique: true });

// TODO: Add compound index on platform + postedAt for dashboard queries.

export const Post: Model<PostDocument> =
  (mongoose.models.Post as Model<PostDocument> | undefined) ??
  mongoose.model<PostDocument>("Post", postSchema);
