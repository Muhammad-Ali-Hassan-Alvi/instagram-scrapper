import Link from "next/link";

import { EXPORT_FORMAT_LABELS, type ExportFormat } from "@/types/consolidated-export";

const FORMATS: ExportFormat[] = ["csv", "pdf", "docx", "html"];

export function ExportPanel({ hasData }: { hasData: boolean }) {
  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold">Export dataset</h2>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Download the consolidated table from MongoDB.
          </p>
        </div>
        <Link
          href="/exports"
          className="text-sm text-zinc-600 underline-offset-2 hover:underline dark:text-zinc-400"
        >
          View all formats →
        </Link>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {FORMATS.map((format) =>
          hasData ? (
            <a
              key={format}
              href={`/api/export?format=${format}`}
              className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium transition hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
            >
              {EXPORT_FORMAT_LABELS[format]}
            </a>
          ) : (
            <span
              key={format}
              className="rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-400 dark:border-zinc-800"
            >
              {EXPORT_FORMAT_LABELS[format]}
            </span>
          ),
        )}
      </div>
    </section>
  );
}
