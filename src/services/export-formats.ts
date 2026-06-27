import { Document, Packer, Paragraph, Table, TableCell, TableRow, TextRun, WidthType } from "docx";
import PDFDocument from "pdfkit";
import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";

import { rowToOrderedValues } from "@/services/export-builder";
import { rowsToCsv } from "@/services/csv-export";
import {
  CONSOLIDATED_EXPORT_COLUMNS,
  type ConsolidatedExportRow,
  type ExportFormat,
} from "@/types/consolidated-export";

function escapeHtml(value: string | number): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function buildHtmlTable(rows: ConsolidatedExportRow[]): string {
  const headerCells = CONSOLIDATED_EXPORT_COLUMNS.map(
    (column) => `<th>${escapeHtml(column)}</th>`,
  ).join("");

  const bodyRows = rows
    .map((row) => {
      const cells = rowToOrderedValues(row)
        .map((value) => `<td>${escapeHtml(value)}</td>`)
        .join("");
      return `<tr>${cells}</tr>`;
    })
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Consolidated Social Analytics Export</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 24px; color: #111; }
    h1 { font-size: 20px; margin-bottom: 8px; }
    p { color: #555; margin-bottom: 16px; }
    table { border-collapse: collapse; width: 100%; font-size: 11px; }
    th, td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; vertical-align: top; }
    th { background: #f3f4f6; position: sticky; top: 0; }
    tr:nth-child(even) { background: #fafafa; }
  </style>
</head>
<body>
  <h1>Consolidated Social Analytics Dataset</h1>
  <p>${rows.length} records · Generated ${new Date().toISOString()}</p>
  <table>
    <thead><tr>${headerCells}</tr></thead>
    <tbody>${bodyRows}</tbody>
  </table>
</body>
</html>`;
}

export async function buildPdfBuffer(rows: ConsolidatedExportRow[]): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      margin: 24,
      size: "A4",
      layout: "landscape",
    });

    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.fontSize(14).text("Consolidated Social Analytics Dataset", { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(10).fillColor("#444").text(`${rows.length} records`);
    doc.moveDown();

    doc.fillColor("#000").fontSize(7);
    doc.text(CONSOLIDATED_EXPORT_COLUMNS.join(" | "), { lineGap: 2 });
    doc.moveDown(0.5);

    for (const row of rows) {
      doc.text(rowToOrderedValues(row).join(" | "), { lineGap: 1 });
    }

    doc.end();
  });
}

export async function buildDocxBuffer(rows: ConsolidatedExportRow[]): Promise<Buffer> {
  const headerRow = new TableRow({
    children: CONSOLIDATED_EXPORT_COLUMNS.map(
      (column) =>
        new TableCell({
          width: { size: 1200, type: WidthType.DXA },
          children: [new Paragraph({ children: [new TextRun({ text: column, bold: true })] })],
        }),
    ),
  });

  const dataRows = rows.map(
    (row) =>
      new TableRow({
        children: rowToOrderedValues(row).map(
          (value) =>
            new TableCell({
              children: [new Paragraph(String(value ?? ""))],
            }),
        ),
      }),
  );

  const document = new Document({
    sections: [
      {
        children: [
          new Paragraph({
            children: [new TextRun({ text: "Consolidated Social Analytics Dataset", bold: true })],
          }),
          new Paragraph(`${rows.length} records · Generated ${new Date().toISOString()}`),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [headerRow, ...dataRows],
          }),
        ],
      },
    ],
  });

  return Packer.toBuffer(document);
}

export interface GeneratedExportFiles {
  csvPath: string;
  pdfPath: string;
  docxPath: string;
  htmlPath: string;
}

export async function writeAllExportFiles(
  rows: ConsolidatedExportRow[],
  dataRefresh: Date,
): Promise<GeneratedExportFiles> {
  const exportDir = join(process.cwd(), "data", "exports");
  mkdirSync(exportDir, { recursive: true });

  const stamp = dataRefresh.toISOString().replace(/[:.]/g, "-");
  const csvPath = join(exportDir, `consolidated-${stamp}.csv`);
  const pdfPath = join(exportDir, `consolidated-${stamp}.pdf`);
  const docxPath = join(exportDir, `consolidated-${stamp}.docx`);
  const htmlPath = join(exportDir, `consolidated-${stamp}.html`);

  writeFileSync(csvPath, rowsToCsv(rows), "utf8");
  writeFileSync(htmlPath, buildHtmlTable(rows), "utf8");
  writeFileSync(pdfPath, await buildPdfBuffer(rows));
  writeFileSync(docxPath, await buildDocxBuffer(rows));

  return { csvPath, pdfPath, docxPath, htmlPath };
}

export function getExportContentType(format: ExportFormat): string {
  switch (format) {
    case "csv":
      return "text/csv; charset=utf-8";
    case "pdf":
      return "application/pdf";
    case "docx":
      return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    case "html":
      return "text/html; charset=utf-8";
  }
}

export function getExportFilename(format: ExportFormat, account?: string): string {
  const stamp = new Date().toISOString().slice(0, 10);
  const suffix = account ? `${account}-` : "consolidated-";
  switch (format) {
    case "csv":
      return `${suffix}${stamp}.csv`;
    case "pdf":
      return `${suffix}${stamp}.pdf`;
    case "docx":
      return `${suffix}${stamp}.docx`;
    case "html":
      return `${suffix}${stamp}.html`;
  }
}

export async function buildExportBuffer(
  rows: ConsolidatedExportRow[],
  format: ExportFormat,
): Promise<Buffer | string> {
  switch (format) {
    case "csv":
      return rowsToCsv(rows);
    case "html":
      return buildHtmlTable(rows);
    case "pdf":
      return buildPdfBuffer(rows);
    case "docx":
      return buildDocxBuffer(rows);
  }
}
