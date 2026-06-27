import { config } from "dotenv";
import { connectDB } from "../src/lib/db";
import { logger } from "../src/utils/logger";

config({ path: ".env.local", override: true });
config();

async function main(): Promise<void> {
  await connectDB();
  logger.info("MongoDB connection test passed");
  process.exit(0);
}

main().catch((error) => {
  logger.error("MongoDB connection test failed", error);
  process.exit(1);
});
