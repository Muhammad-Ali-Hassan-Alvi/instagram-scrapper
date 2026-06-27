import { NextResponse } from "next/server";

import {
  buildConsolidatedExportRows,
  summarizeExportRows,
} from "@/services/export-builder";
import { CONSOLIDATED_EXPORT_COLUMNS, EXPORT_FORMAT_LABELS } from "@/types/consolidated-export";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Returns export metadata and available download formats. */
export async function GET(): Promise<NextResponse> {
  try {
    const rows = await buildConsolidatedExportRows();
    const meta = summarizeExportRows(rows);

    return NextResponse.json({
      success: true,
      meta,
      columns: CONSOLIDATED_EXPORT_COLUMNS,
      formats: EXPORT_FORMAT_LABELS,
      downloads: {
        csv: "/api/export?format=csv",
        pdf: "/api/export?format=pdf",
        docx: "/api/export?format=docx",
        html: "/api/export?format=html",
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to load export metadata",
        columns: CONSOLIDATED_EXPORT_COLUMNS,
        formats: EXPORT_FORMAT_LABELS,
      },
      { status: 500 },
    );
  }
}
