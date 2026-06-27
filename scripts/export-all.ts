import { buildConsolidatedExportRows } from "../src/services/export-builder";
import { writeAllExportFiles } from "../src/services/export-formats";
import { logger } from "../src/utils/logger";

async function main(): Promise<void> {
  const rows = await buildConsolidatedExportRows();

  if (!rows.length) {
    logger.warn("No rows in database — run a scrape first");
    process.exit(1);
  }

  const files = await writeAllExportFiles(rows, new Date());
  logger.info("Export files written:");
  logger.info(`  CSV:  ${files.csvPath}`);
  logger.info(`  PDF:  ${files.pdfPath}`);
  logger.info(`  DOCX: ${files.docxPath}`);
  logger.info(`  HTML: ${files.htmlPath}`);
}

main().catch((error) => {
  logger.error("Export failed", error);
  process.exit(1);
});
