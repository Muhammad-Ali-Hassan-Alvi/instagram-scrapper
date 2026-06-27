export interface TikTokUserDetailScope {
  userInfo?: {
    user?: {
      id?: string;
      uniqueId?: string;
      secUid?: string;
      nickname?: string;
      signature?: string;
      avatarLarger?: string;
      avatarMedium?: string;
      verified?: boolean;
      privateAccount?: boolean;
    };
    stats?: {
      followerCount?: number;
      followingCount?: number;
      videoCount?: number;
    };
  };
  itemList?: TikTokVideoItem[];
  itemModule?: Record<string, TikTokVideoItem>;
}

export interface TikTokVideoItem {
  id?: string;
  desc?: string;
  createTime?: number;
  video?: {
    duration?: number;
    cover?: string;
    playAddr?: string;
    downloadAddr?: string;
  };
  stats?: {
    diggCount?: number;
    commentCount?: number;
    shareCount?: number;
    playCount?: number;
    collectCount?: number;
  };
}

export interface TikTokItemListResponse {
  itemList?: TikTokVideoItem[];
  cursor?: string;
  hasMore?: boolean;
  statusCode?: number;
  statusMsg?: string;
}

export interface TikTokRehydratePayload {
  __DEFAULT_SCOPE__?: {
    "webapp.user-detail"?: TikTokUserDetailScope;
  };
}
