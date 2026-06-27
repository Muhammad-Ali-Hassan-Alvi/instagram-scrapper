import Link from "next/link";

import { AnalyticsShell } from "@/components/analytics/AnalyticsShell";
import { buildConsolidatedExportRows, summarizeExportRows } from "@/services/export-builder";
import { CONSOLIDATED_EXPORT_COLUMNS, EXPORT_FORMAT_LABELS } from "@/types/consolidated-export";
import { ui } from "@/lib/ui-classes";

export const dynamic = "force-dynamic";

export default async function ExportsPage() {
  let meta = {
    rowCount: 0,
    accountCount: 0,
    lastDataRefresh: null as string | null,
    platforms: [] as string[],
    accounts: [] as { username: string; rowCount: number }[],
  };

  try {
    const rows = await buildConsolidatedExportRows();
    meta = summarizeExportRows(rows);
  } catch {
    // empty
  }

  const hasData = meta.rowCount > 0;
  const formats = [
    { key: "csv", href: "/api/export?format=csv" },
    { key: "pdf", href: "/api/export?format=pdf" },
    { key: "docx", href: "/api/export?format=docx" },
    { key: "html", href: "/api/export?format=html" },
  ] as const;

  return (
    <AnalyticsShell title="Exports">
      <div className="space-y-6">
        <section className={`${ui.card} p-6`}>
          <h2 className="text-base font-semibold text-slate-900">Dataset status</h2>
          <dl className="mt-4 grid gap-4 sm:grid-cols-3">
            <div>
              <dt className="text-sm text-slate-500">Records</dt>
              <dd className="mt-1 text-2xl font-semibold text-slate-900">{meta.rowCount}</dd>
            </div>
            <div>
              <dt className="text-sm text-slate-500">Accounts</dt>
              <dd className="mt-1 text-2xl font-semibold text-slate-900">{meta.accountCount}</dd>
            </div>
            <div>
              <dt className="text-sm text-slate-500">Last refresh</dt>
              <dd className="mt-1 text-sm text-slate-700">
                {meta.lastDataRefresh
                  ? new Date(meta.lastDataRefresh).toLocaleString()
                  : "Not available"}
              </dd>
            </div>
          </dl>
        </section>

        <section className={`${ui.card} p-6`}>
          <h2 className="text-base font-semibold text-slate-900">All accounts (combined)</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {formats.map(({ key, href }) =>
              hasData ? (
                <a key={key} href={href} className={`${ui.btnPrimary} py-3 text-center`}>
                  {EXPORT_FORMAT_LABELS[key]}
                </a>
              ) : (
                <span
                  key={key}
                  className="rounded-lg border border-slate-200 px-4 py-3 text-center text-sm text-slate-400"
                >
                  {EXPORT_FORMAT_LABELS[key]}
                </span>
              ),
            )}
          </div>
        </section>

        {meta.accounts.length > 0 && (
          <section className={`${ui.card} p-6`}>
            <h2 className="text-base font-semibold text-slate-900">Separate per account</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {meta.accounts.map((account) => (
                <div
                  key={account.username}
                  className="rounded-lg border border-violet-100 bg-violet-50 p-4"
                >
                  <h3 className="font-medium text-violet-900">@{account.username}</h3>
                  <p className="mt-1 text-sm text-violet-800">{account.rowCount} posts</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {(["csv", "pdf", "docx", "html"] as const).map((format) => (
                      <a
                        key={format}
                        href={`/api/export?format=${format}&account=${account.username}`}
                        className="rounded bg-violet-600 px-3 py-1.5 text-xs text-white hover:bg-violet-500"
                      >
                        {format.toUpperCase()}
                      </a>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        <section className={`${ui.card} p-6`}>
          <h2 className="text-base font-semibold text-slate-900">Columns</h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {CONSOLIDATED_EXPORT_COLUMNS.map((column) => (
              <span
                key={column}
                className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600"
              >
                {column}
              </span>
            ))}
          </div>
        </section>

        <Link href="/" className={ui.link}>
          ← Back to Overview
        </Link>
      </div>
    </AnalyticsShell>
  );
}
