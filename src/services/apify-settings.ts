import { ApifyClient } from "apify-client";

import { DEFAULT_TARGET_ACCOUNTS, type TargetAccount } from "@/config/accounts";
import { findTargetAccount as findConfiguredAccount } from "@/lib/account-route";
import { connectDB } from "@/lib/db";
import {
  getApifyInstagramActorId,
  getApifyTikTokActorId,
  getEnvApifyToken,
} from "@/lib/apify-config";
import {
  ApifySettings,
  type ApifyAccountRun,
  type ApifyAccountRunStatus,
  type ApifyScrapeSummary,
  type ApifySettingsDocument,
} from "@/models/ApifySettings";
import { formatApifyUserError } from "@/services/apify-errors";

export interface ApifyAccountRunPublic {
  platform: "instagram" | "tiktok";
  username: string;
  status: ApifyAccountRunStatus;
  actorId: string;
  startedAt: string | null;
  completedAt: string | null;
  posts: number;
  error: string | null;
  message: string;
}

export interface ApifySettingsPublic {
  hasToken: boolean;
  tokenHint: string;
  apifyUsername: string;
  lastValidatedAt: string | null;
  scrapeStatus: ApifySettingsDocument["scrapeStatus"];
  scrapePhase: string;
  scrapeMessage: string;
  lastScrapeAt: string | null;
  lastScrapeError: string | null;
  lastScrapeSummary: ApifyScrapeSummary | null;
  accountRuns: ApifyAccountRunPublic[];
  tokenSource: "database" | "env" | "none";
}

function accountKey(account: { platform: string; username: string }): string {
  return `${account.platform}:${account.username.toLowerCase()}`;
}

function actorIdForPlatform(platform: TargetAccount["platform"]): string {
  return platform === "tiktok" ? getApifyTikTokActorId() : getApifyInstagramActorId();
}

function maskToken(token: string): string {
  const trimmed = token.trim();
  if (trimmed.length <= 8) return "••••";
  return `••••${trimmed.slice(-4)}`;
}

function buildAccountRunsPublic(doc: ApifySettingsDocument | null): ApifyAccountRunPublic[] {
  const stored = doc?.accountRuns ?? [];

  return DEFAULT_TARGET_ACCOUNTS.map((target) => {
    const found = stored.find(
      (run) =>
        run.platform === target.platform &&
        run.username.toLowerCase() === target.username.toLowerCase(),
    );

    return {
      platform: target.platform,
      username: target.username,
      status: found?.status ?? "idle",
      actorId: found?.actorId || actorIdForPlatform(target.platform),
      startedAt: found?.startedAt?.toISOString() ?? null,
      completedAt: found?.completedAt?.toISOString() ?? null,
      posts: found?.posts ?? 0,
      error: found?.error ?? null,
      message: found?.message ?? "",
    };
  });
}

async function getSettingsDoc(): Promise<ApifySettingsDocument | null> {
  await connectDB();
  return ApifySettings.findOne();
}

async function ensureSettingsDoc(): Promise<ApifySettingsDocument> {
  await connectDB();
  const existing = await ApifySettings.findOne();
  if (existing) return existing;

  return ApifySettings.create({});
}

export async function getApifyToken(): Promise<string | null> {
  const doc = await getSettingsDoc();
  if (doc?.token?.trim()) return doc.token.trim();
  return getEnvApifyToken();
}

export async function getApifySettingsPublic(): Promise<ApifySettingsPublic> {
  const doc = await getSettingsDoc();
  const envToken = getEnvApifyToken();
  const dbToken = doc?.token?.trim() ?? "";

  let tokenSource: ApifySettingsPublic["tokenSource"] = "none";
  if (dbToken) tokenSource = "database";
  else if (envToken) tokenSource = "env";

  return {
    hasToken: Boolean(dbToken || envToken),
    tokenHint: doc?.tokenHint || (envToken ? maskToken(envToken) : ""),
    apifyUsername: doc?.apifyUsername ?? "",
    lastValidatedAt: doc?.lastValidatedAt?.toISOString() ?? null,
    scrapeStatus: doc?.scrapeStatus ?? "idle",
    scrapePhase: doc?.scrapePhase ?? "",
    scrapeMessage: doc?.scrapeMessage ?? "",
    lastScrapeAt: doc?.lastScrapeAt?.toISOString() ?? null,
    lastScrapeError: doc?.lastScrapeError ?? null,
    lastScrapeSummary: doc?.lastScrapeSummary ?? null,
    accountRuns: buildAccountRunsPublic(doc),
    tokenSource,
  };
}

export async function validateApifyToken(token: string): Promise<{ username: string }> {
  const client = new ApifyClient({ token: token.trim() });
  try {
    const user = await client.user().get();
    return { username: user.username ?? user.email ?? "Apify user" };
  } catch (error) {
    throw new Error(formatApifyUserError(error));
  }
}

export async function saveApifyToken(token: string): Promise<ApifySettingsPublic> {
  const trimmed = token.trim();
  if (!trimmed) {
    throw new Error("Apify API token is required.");
  }

  const { username } = await validateApifyToken(trimmed);
  const doc = await ensureSettingsDoc();

  doc.token = trimmed;
  doc.tokenHint = maskToken(trimmed);
  doc.apifyUsername = username;
  doc.lastValidatedAt = new Date();
  doc.lastScrapeError = null;
  await doc.save();

  return getApifySettingsPublic();
}

export async function updateApifyScrapeState(
  update: Partial<
    Pick<
      ApifySettingsDocument,
      | "scrapeStatus"
      | "scrapePhase"
      | "scrapeMessage"
      | "lastScrapeAt"
      | "lastScrapeError"
      | "lastScrapeSummary"
    >
  >,
): Promise<void> {
  const doc = await ensureSettingsDoc();
  Object.assign(doc, update);
  await doc.save();
}

export async function updateAccountRun(
  account: Pick<TargetAccount, "platform" | "username">,
  update: Partial<ApifyAccountRun>,
): Promise<void> {
  const doc = await ensureSettingsDoc();
  const key = accountKey(account);
  const runs = [...(doc.accountRuns ?? [])];
  let index = runs.findIndex((run) => accountKey(run) === key);

  if (index === -1) {
    runs.push({
      platform: account.platform,
      username: account.username.toLowerCase(),
      status: "idle",
      actorId: actorIdForPlatform(account.platform),
      startedAt: null,
      completedAt: null,
      posts: 0,
      error: null,
      message: "",
    });
    index = runs.length - 1;
  }

  runs[index] = { ...runs[index], ...update };
  doc.accountRuns = runs;
  doc.markModified("accountRuns");
  await doc.save();
}

export async function markRemainingAccountsSkipped(
  afterAccount: Pick<TargetAccount, "platform" | "username">,
  message: string,
): Promise<void> {
  const doc = await ensureSettingsDoc();
  const startIndex = DEFAULT_TARGET_ACCOUNTS.findIndex(
    (account) => accountKey(account) === accountKey(afterAccount),
  );

  if (startIndex === -1) return;

  const runs = [...(doc.accountRuns ?? [])];

  for (const account of DEFAULT_TARGET_ACCOUNTS.slice(startIndex + 1)) {
    const key = accountKey(account);
    let index = runs.findIndex((run) => accountKey(run) === key);

    if (index === -1) {
      runs.push({
        platform: account.platform,
        username: account.username.toLowerCase(),
        status: "skipped",
        actorId: actorIdForPlatform(account.platform),
        startedAt: null,
        completedAt: new Date(),
        posts: 0,
        error: null,
        message,
      });
      continue;
    }

    if (runs[index].status === "success") continue;

    runs[index] = {
      ...runs[index],
      status: "skipped",
      completedAt: new Date(),
      message,
      error: null,
    };
  }

  doc.accountRuns = runs;
  doc.markModified("accountRuns");
  await doc.save();
}

export async function requireApifyToken(): Promise<string> {
  const token = await getApifyToken();
  if (!token) {
    throw new Error("No Apify API token saved. Add your token on the Apify settings page.");
  }
  return token;
}

export function findTargetAccount(
  platform: "instagram" | "tiktok",
  username: string,
): TargetAccount | undefined {
  return findConfiguredAccount(platform, username);
}
