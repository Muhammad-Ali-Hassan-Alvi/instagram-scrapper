import mongoose from "mongoose";

import { Account } from "@/models/Account";
import { getEnv } from "@/config/env";
import { logger } from "@/utils/logger";

interface MongooseCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

declare global {
  var mongooseCache: MongooseCache | undefined;
}

const cached: MongooseCache = global.mongooseCache ?? {
  conn: null,
  promise: null,
};

global.mongooseCache = cached;

async function ensureAccountIndexes(): Promise<void> {
  try {
    await Account.collection.dropIndex("username_1");
    logger.info("Dropped legacy username-only index on accounts");
  } catch {
    // Index may already be removed.
  }

  await Account.syncIndexes();
}

/**
 * Establishes a singleton MongoDB connection via Mongoose.
 * Reuses the existing connection during Next.js hot reloads.
 */
export async function connectDB(): Promise<typeof mongoose> {
  if (cached.conn && mongoose.connection.readyState === 1) {
    return cached.conn;
  }

  if (cached.conn && mongoose.connection.readyState !== 1) {
    cached.conn = null;
    cached.promise = null;
  }

  if (!cached.promise) {
    const { MONGODB_URI } = getEnv();

    cached.promise = mongoose
      .connect(MONGODB_URI, {
        serverSelectionTimeoutMS: 30000,
        maxPoolSize: 10,
        socketTimeoutMS: 45000,
      })
      .then((mongooseInstance) => {
        const databaseName = mongooseInstance.connection.db?.databaseName ?? "unknown";
        logger.info(`MongoDB connected successfully (database: ${databaseName})`);
        return mongooseInstance;
      });
  }

  try {
    cached.conn = await cached.promise;
    if (process.env.NODE_ENV === "development") {
      await ensureAccountIndexes();
    }
  } catch (error) {
    cached.conn = null;
    cached.promise = null;
    logger.error("MongoDB connection failed", error);
    throw error;
  }

  return cached.conn;
}
