export type Platform = "instagram" | "tiktok";

export type AccountType = "instagram" | "tiktok";

export interface BaseDocumentTimestamps {
  createdAt: Date;
  updatedAt: Date;
}

export interface ScrapeMetadata {
  platform: Platform;
  accountHandle: string;
  scrapedAt: Date;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}
