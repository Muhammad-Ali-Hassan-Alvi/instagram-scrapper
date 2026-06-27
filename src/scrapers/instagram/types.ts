export type { ScrapedPost, ScrapedProfile } from "@/scrapers/shared/types";

export interface FeedUserResponse {
  items?: FeedItem[];
  num_results?: number;
  more_available?: boolean;
  next_max_id?: string;
  status?: string;
  message?: string;
  require_login?: boolean;
}

export interface FeedItem {
  id?: string;
  pk?: string;
  code?: string;
  taken_at?: number;
  media_type?: number;
  product_type?: string;
  like_count?: number;
  comment_count?: number;
  play_count?: number;
  view_count?: number;
  media_repost_count?: number;
  video_duration?: number;
  caption?: { text?: string } | null;
  image_versions2?: { candidates?: { url?: string }[] };
  video_versions?: { url?: string }[];
  thumbnail_url?: string;
}

export interface WebProfileInfoResponse {
  data?: {
    user?: {
      id?: string;
      username?: string;
      full_name?: string;
      biography?: string;
      profile_pic_url_hd?: string;
      profile_pic_url?: string;
      is_verified?: boolean;
      is_private?: boolean;
      edge_followed_by?: { count?: number };
      edge_follow?: { count?: number };
      edge_owner_to_timeline_media?: {
        count?: number;
        edges?: { node?: WebProfilePostNode }[];
        page_info?: { has_next_page?: boolean; end_cursor?: string };
      };
    };
  };
}

export interface WebProfilePostNode {
  id?: string;
  shortcode?: string;
  __typename?: string;
  product_type?: string;
  is_video?: boolean;
  display_url?: string;
  thumbnail_src?: string;
  video_view_count?: number;
  video_duration?: number;
  taken_at_timestamp?: number;
  edge_liked_by?: { count?: number };
  edge_media_to_comment?: { count?: number };
  edge_media_to_caption?: { edges?: { node?: { text?: string } }[] };
}
