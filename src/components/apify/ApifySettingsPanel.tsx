"use client";

import { useCallback, useEffect, useState } from "react";

import { accountLabel } from "@/lib/account-route";
import { ui } from "@/lib/ui-classes";

interface ApifyAccountRunPublic {
  platform: "instagram" | "tiktok";
  username: string;
  status: "idle" | "running" | "success" | "error" | "skipped";
  actorId: string;
  startedAt: string | null;
  completedAt: string | null;
  posts: number;
  error: string | null;
  message: string;
}

interface ApifySettingsPublic {
  hasToken: boolean;
  tokenHint: string;
  apifyUsername: string;
  lastValidatedAt: string | null;
  scrapeStatus: "idle" | "running" | "success" | "error";
  scrapePhase: string;
  scrapeMessage: string;
  lastScrapeAt: string | null;
  lastScrapeError: string | null;
  lastScrapeSummary: {
    tiktokPosts: number;
    instagramPosts: number;
    accounts: { platform: string; username: string; posts: number }[];
  } | null;
  accountRuns: ApifyAccountRunPublic[];
  tokenSource: "database" | "env" | "none";
  inProgress?: boolean;
}

function statusBadge(status: ApifyAccountRunPublic["status"]): string {
  switch (status) {
    case "running":
      return "bg-violet-100 text-violet-800";
    case "success":
      return "bg-emerald-100 text-emerald-800";
    case "error":
      return "bg-red-100 text-red-800";
    case "skipped":
      return "bg-amber-100 text-amber-900";
    default:
      return "bg-slate-100 text-slate-600";
  }
}

function isQuotaError(message: string | null | undefined): boolean {
  return Boolean(message && /credit|usage limit|quota|limit/i.test(message));
}

export function ApifySettingsPanel() {
  const [settings, setSettings] = useState<ApifySettingsPublic | null>(null);
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [runningKey, setRunningKey] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadStatus = useCallback(async () => {
    try {
      const response = await fetch("/api/apify/scrape", { cache: "no-store" });
      const data = (await response.json()) as ApifySettingsPublic & { error?: string };
      if (!response.ok) {
        throw new Error(data.error ?? "Failed to load Apify status.");
      }
      setSettings(data);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load Apify status.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  useEffect(() => {
    if (!settings?.inProgress && settings?.scrapeStatus !== "running") return;

    const timer = setInterval(() => {
      void loadStatus();
    }, 5000);

    return () => clearInterval(timer);
  }, [settings?.inProgress, settings?.scrapeStatus, loadStatus]);

  async function handleSaveToken(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch("/api/apify/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = (await response.json()) as ApifySettingsPublic & { error?: string };

      if (!response.ok) {
        throw new Error(data.error ?? "Failed to save token.");
      }

      setSettings((prev) => ({ ...data, inProgress: prev?.inProgress }));
      setToken("");
      setMessage(`Token saved for ${data.apifyUsername || "your Apify account"}.`);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to save token.");
    } finally {
      setSaving(false);
    }
  }

  async function handleStartScrape(target?: { platform: "instagram" | "tiktok"; username: string }) {
    const key = target ? `${target.platform}:${target.username}` : "all";
    setRunningKey(key);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch("/api/apify/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(target ?? {}),
      });
      const data = (await response.json()) as { started?: boolean; error?: string };

      if (!response.ok) {
        throw new Error(data.error ?? "Failed to start scrape.");
      }

      setMessage(
        target
          ? `Started Apify scrape for ${accountLabel(target.platform, target.username)}.`
          : "Started all accounts one by one. Each account runs as its own Apify job.",
      );
      await loadStatus();
    } catch (scrapeError) {
      setError(scrapeError instanceof Error ? scrapeError.message : "Failed to start scrape.");
    } finally {
      setRunningKey(null);
    }
  }

  const quotaError = isQuotaError(settings?.lastScrapeError);
  const busy = Boolean(
    settings?.inProgress || settings?.scrapeStatus === "running" || runningKey,
  );

  return (
    <div className="space-y-6">
      <section className={`${ui.card} p-6`}>
        <h2 className="text-base font-semibold text-slate-900">How to get your Apify API token</h2>
        <ol className="mt-4 list-decimal space-y-3 pl-5 text-sm text-slate-700">
          <li>
            Create a free account at{" "}
            <a
              href="https://console.apify.com/sign-up"
              target="_blank"
              rel="noreferrer"
              className={ui.link}
            >
              console.apify.com
            </a>
            .
          </li>
          <li>
            Open{" "}
            <a
              href="https://console.apify.com/account/integrations"
              target="_blank"
              rel="noreferrer"
              className={ui.link}
            >
              Settings → Integrations
            </a>{" "}
            in the Apify Console.
          </li>
          <li>Copy your <strong>Personal API token</strong> (starts with <code>apify_api_</code>).</li>
          <li>Paste it below and click Save token.</li>
          <li>
            Run each account separately so you can see exactly when each one finished and which
            account hit the $5 credit limit.
          </li>
        </ol>
        <p className="mt-4 text-sm text-slate-500">
          Each account uses its own Apify run. If one account exhausts credits, swap the token and
          run only the remaining accounts.
        </p>
      </section>

      <section className={`${ui.card} p-6`}>
        <h2 className="text-base font-semibold text-slate-900">Apify API token</h2>

        {settings?.hasToken && (
          <div className="mt-4 rounded-lg border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
            <p>
              Token configured{" "}
              {settings.tokenHint ? `(${settings.tokenHint})` : ""}
              {settings.apifyUsername ? ` · ${settings.apifyUsername}` : ""}
            </p>
            {settings.tokenSource === "env" && (
              <p className="mt-1 text-emerald-800">
                Loaded from <code>APIFY_TOKEN</code> in environment. Saving here stores it in
                MongoDB instead.
              </p>
            )}
            {settings.lastValidatedAt && (
              <p className="mt-1 text-emerald-800">
                Last validated {new Date(settings.lastValidatedAt).toLocaleString()}
              </p>
            )}
          </div>
        )}

        <form onSubmit={handleSaveToken} className="mt-4 space-y-4">
          <div>
            <label htmlFor="apify-token" className={ui.label}>
              API token
            </label>
            <input
              id="apify-token"
              type="password"
              autoComplete="off"
              value={token}
              onChange={(event) => setToken(event.target.value)}
              placeholder="apify_api_..."
              className={`${ui.input} mt-2 w-full max-w-xl`}
            />
          </div>
          <button type="submit" disabled={saving || !token.trim()} className={ui.btnPrimary}>
            {saving ? "Saving…" : "Save token"}
          </button>
        </form>
      </section>

      <section className={`${ui.card} p-6`}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Scrape via Apify</h2>
            <p className="mt-2 max-w-2xl text-sm text-slate-600">
              Each account runs as a separate Apify job. You will see its own start time, finish
              time, post count, and error if credits run out.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void handleStartScrape()}
            disabled={busy || loading || !settings?.hasToken}
            className={ui.btnPrimary}
          >
            {busy && !runningKey?.includes(":") ? "Running all…" : "Run all (one by one)"}
          </button>
        </div>

        {settings?.scrapeStatus === "running" && (
          <div className="mt-4 rounded-lg border border-violet-100 bg-violet-50 px-4 py-3 text-sm text-violet-900">
            <p className="font-medium">
              Current: {settings.scrapePhase ? `@${settings.scrapePhase}` : "starting"}
            </p>
            <p className="mt-1">{settings.scrapeMessage}</p>
          </div>
        )}

        <div className="mt-5 grid gap-4">
          {settings?.accountRuns.map((run) => {
            const key = `${run.platform}:${run.username}`;
            const runBusy = runningKey === key || (busy && settings.scrapePhase === run.username);
            const quota = isQuotaError(run.error);

            return (
              <div
                key={key}
                className="rounded-lg border border-slate-200 bg-slate-50 p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-medium text-slate-900">
                        {accountLabel(run.platform, run.username)}
                      </h3>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusBadge(run.status)}`}
                      >
                        {run.status}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">{run.actorId}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      void handleStartScrape({ platform: run.platform, username: run.username })
                    }
                    disabled={busy || loading || !settings?.hasToken}
                    className={ui.btn}
                  >
                    {runBusy ? "Running…" : "Run this account"}
                  </button>
                </div>

                <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
                  <div>
                    <dt className="text-slate-500">Started</dt>
                    <dd className="mt-1 text-slate-800">
                      {run.startedAt ? new Date(run.startedAt).toLocaleString() : "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Finished</dt>
                    <dd className="mt-1 text-slate-800">
                      {run.completedAt ? new Date(run.completedAt).toLocaleString() : "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Posts imported</dt>
                    <dd className="mt-1 text-slate-800">{run.posts}</dd>
                  </div>
                </dl>

                {run.message && (
                  <p className="mt-3 text-sm text-slate-700">{run.message}</p>
                )}

                {run.error && (
                  <div
                    className={`mt-3 rounded-lg border px-3 py-2 text-sm ${
                      quota
                        ? "border-amber-200 bg-amber-50 text-amber-950"
                        : "border-red-200 bg-red-50 text-red-900"
                    }`}
                  >
                    <p className="font-medium">
                      {quota ? "Apify credit limit on this account run" : "Run failed"}
                    </p>
                    <p className="mt-1">{run.error}</p>
                    {quota && (
                      <p className="mt-2">
                        Save a new token above, then click Run this account again for the accounts
                        that did not finish.
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {(error || settings?.lastScrapeError) && (
          <div
            className={`mt-4 rounded-lg border px-4 py-3 text-sm ${
              quotaError
                ? "border-amber-200 bg-amber-50 text-amber-950"
                : "border-red-200 bg-red-50 text-red-900"
            }`}
          >
            <p className="font-medium">
              {quotaError ? "Batch stopped — Apify limit reached" : "Scrape error"}
            </p>
            <p className="mt-1">{error ?? settings?.lastScrapeError}</p>
          </div>
        )}

        {message && !error && (
          <p className="mt-4 text-sm text-emerald-700">{message}</p>
        )}
      </section>
    </div>
  );
}
