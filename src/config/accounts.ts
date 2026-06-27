export interface TargetAccount {
  platform: "instagram" | "tiktok";
  username: string;
  category?: string;
}

/** Default scrape targets for this project. */
export const DEFAULT_TARGET_ACCOUNTS: TargetAccount[] = [
  { platform: "instagram", username: "nicky.cass", category: "creator" },
  { platform: "instagram", username: "ball5show", category: "media" },
  { platform: "tiktok", username: "nicky.cass1", category: "creator" },
  { platform: "tiktok", username: "ball5show", category: "media" },
];
