import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";

import {
  CONSOLIDATED_EXPORT_COLUMNS,
  type ConsolidatedExportRow,
} from "@/types/consolidated-export";

function escapeCsv(value: string | number): string {
  const str = String(value ?? "");
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function rowsToCsv(rows: ConsolidatedExportRow[]): string {
  const header = CONSOLIDATED_EXPORT_COLUMNS.join(",");
  const lines = rows.map((row) =>
    CONSOLIDATED_EXPORT_COLUMNS.map((column) => escapeCsv(row[column] ?? "")).join(","),
  );
  return `${[header, ...lines].join("\n")}\n`;
}

export interface CsvFileExportResult {
  consolidatedPath: string;
  snapshotPath: string;
  rowCount: number;
}

export function writeConsolidatedCsv(
  rows: ConsolidatedExportRow[],
  dataRefresh: Date,
): CsvFileExportResult {
  const dataDir = join(process.cwd(), "data");
  const snapshotDir = join(dataDir, "snapshots");
  mkdirSync(snapshotDir, { recursive: true });

  const csv = rowsToCsv(rows);
  const consolidatedPath = join(dataDir, "consolidated.csv");
  writeFileSync(consolidatedPath, csv, "utf8");

  const dateStamp = dataRefresh.toISOString().slice(0, 10);
  const snapshotPath = join(snapshotDir, `${dateStamp}.csv`);
  writeFileSync(snapshotPath, csv, "utf8");

  return { consolidatedPath, snapshotPath, rowCount: rows.length };
}

export function appendHistoricalCsvSnapshot(
  rows: ConsolidatedExportRow[],
  dataRefresh: Date,
): string {
  const historyDir = join(process.cwd(), "data", "history");
  mkdirSync(historyDir, { recursive: true });

  const historyPath = join(
    historyDir,
    `snapshot-${dataRefresh.toISOString().replace(/[:.]/g, "-")}.csv`,
  );
  writeFileSync(historyPath, rowsToCsv(rows), "utf8");
  return historyPath;
}
