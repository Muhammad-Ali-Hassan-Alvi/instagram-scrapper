import { DEFAULT_TARGET_ACCOUNTS } from "@/config/accounts";

export type ScrapePhase =
  | "idle"
  | "starting"
  | "login"
  | "scraping"
  | "exporting"
  | "complete"
  | "error";

export type AccountScrapeStatus = "pending" | "running" | "done" | "failed";

export interface AccountProgress {
  username: string;
  status: AccountScrapeStatus;
  postsCollected: number;
  totalPosts: number;
  message?: string;
}

export interface ScrapeStateSnapshot {
  phase: ScrapePhase;
  message: string;
  accounts: AccountProgress[];
  startedAt: string | null;
  completedAt: string | null;
  error: string | null;
}

const defaultUsernames = DEFAULT_TARGET_ACCOUNTS.filter(
  (account) => account.platform === "instagram",
).map((account) => account.username);

let phase: ScrapePhase = "idle";
let message = "";
let accounts: AccountProgress[] = [];
let startedAt: Date | null = null;
let completedAt: Date | null = null;
let error: string | null = null;

function defaultAccounts(): AccountProgress[] {
  return defaultUsernames.map((username) => ({
    username,
    status: "pending",
    postsCollected: 0,
    totalPosts: 0,
  }));
}

export function resetScrapeState(): void {
  phase = "starting";
  message = "Starting scrape…";
  accounts = defaultAccounts();
  startedAt = new Date();
  completedAt = null;
  error = null;
}

export function setScrapePhase(nextPhase: ScrapePhase, nextMessage: string): void {
  phase = nextPhase;
  message = nextMessage;
}

export function setAccountRunning(username: string, totalPosts = 0): void {
  const row = accounts.find((account) => account.username === username);
  if (row) {
    row.status = "running";
    row.totalPosts = totalPosts;
    row.message = "Scraping posts…";
    return;
  }
  accounts.push({
    username,
    status: "running",
    postsCollected: 0,
    totalPosts,
    message: "Scraping posts…",
  });
}

export function setAccountProgress(
  username: string,
  update: Partial<Pick<AccountProgress, "postsCollected" | "totalPosts" | "message">>,
): void {
  const row = accounts.find((account) => account.username === username);
  if (!row) return;
  Object.assign(row, update);
}

export function setAccountDone(
  username: string,
  postsCollected: number,
  totalPosts: number,
): void {
  const row = accounts.find((account) => account.username === username);
  if (row) {
    row.status = "done";
    row.postsCollected = postsCollected;
    row.totalPosts = totalPosts;
    row.message = undefined;
    return;
  }
  accounts.push({
    username,
    status: "done",
    postsCollected,
    totalPosts,
  });
}

export function setAccountFailed(username: string, accountError: string): void {
  const row = accounts.find((account) => account.username === username);
  if (row) {
    row.status = "failed";
    row.message = accountError;
    return;
  }
  accounts.push({
    username,
    status: "failed",
    postsCollected: 0,
    totalPosts: 0,
    message: accountError,
  });
}

export function setScrapeError(scrapeError: string): void {
  phase = "error";
  error = scrapeError;
  message = scrapeError;
}

export function markScrapeComplete(): void {
  phase = "complete";
  message = "Data ready";
  completedAt = new Date();
  error = null;
}

export function markScrapeIdle(): void {
  phase = "idle";
  message = "";
  completedAt = completedAt ?? new Date();
}

export function getScrapeStateSnapshot(): ScrapeStateSnapshot {
  return {
    phase,
    message,
    accounts: accounts.map((account) => ({ ...account })),
    startedAt: startedAt?.toISOString() ?? null,
    completedAt: completedAt?.toISOString() ?? null,
    error,
  };
}
