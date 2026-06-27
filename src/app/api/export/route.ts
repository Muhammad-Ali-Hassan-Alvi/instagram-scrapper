import { NextResponse } from "next/server";

import {
  buildConsolidatedExportRows,
  summarizeExportRows,
} from "@/services/export-builder";
import {
  buildExportBuffer,
  getExportContentType,
  getExportFilename,
} from "@/services/export-formats";
import type { ExportFormat } from "@/types/consolidated-export";
import { logger } from "@/utils/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FORMATS: ExportFormat[] = ["csv", "pdf", "docx", "html"];

function parseFormat(value: string | null): ExportFormat | null {
  if (!value) return null;
  return FORMATS.includes(value as ExportFormat) ? (value as ExportFormat) : null;
}

/** Download consolidated dataset from MongoDB in CSV, PDF, Word, or HTML table format. */
export async function GET(request: Request): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const format = parseFormat(searchParams.get("format"));
  const account = searchParams.get("account") ?? undefined;
  const platform = searchParams.get("platform") ?? undefined;

  if (!format) {
    return NextResponse.json(
      {
        success: false,
        error: "Invalid format. Use csv, pdf, docx, or html.",
        formats: FORMATS,
      },
      { status: 400 },
    );
  }

  try {
    const rows = await buildConsolidatedExportRows(new Date(), account, platform);

    if (!rows.length) {
      return NextResponse.json(
        {
          success: false,
          error: account
            ? `No data for @${account}. Run a scrape first.`
            : "No data in database yet. Run a scrape first.",
        },
        { status: 404 },
      );
    }

    const payload = await buildExportBuffer(rows, format);
    const body = typeof payload === "string" ? payload : new Uint8Array(payload);

    return new NextResponse(body, {
      headers: {
        "Content-Type": getExportContentType(format),
        "Content-Disposition": `attachment; filename="${getExportFilename(format, account)}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    logger.error("Export failed", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Export failed",
      },
      { status: 500 },
    );
  }
}

/** Dataset summary for the exports UI. */
export async function HEAD(): Promise<NextResponse> {
  try {
    const rows = await buildConsolidatedExportRows();
    const meta = summarizeExportRows(rows);
    return new NextResponse(null, {
      headers: {
        "X-Row-Count": String(meta.rowCount),
        "X-Account-Count": String(meta.accountCount),
        "X-Last-Refresh": meta.lastDataRefresh ?? "",
      },
    });
  } catch {
    return new NextResponse(null, { status: 500 });
  }
}
