import { PostType } from "@/models/Post";

export type ScrapePlatform = "instagram" | "tiktok";

export interface ScrapedProfile {
  platform: ScrapePlatform;
  accountId: string;
  username: string;
  displayName: string;
  biography: string;
  profileImage: string;
  followers: number;
  following: number;
  totalPosts: number;
  verified: boolean;
  isPrivate: boolean;
  category: string;
}

export interface ScrapedPost {
  platform: ScrapePlatform;
  accountUsername: string;
  accountId: string;
  category: string;
  postId: string;
  shortcode: string;
  postUrl: string;
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
}
