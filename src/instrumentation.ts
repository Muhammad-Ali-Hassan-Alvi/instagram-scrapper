export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") {
    return;
  }

  try {
    const { connectDB } = await import("@/lib/db");
    await connectDB();
  } catch (error) {
    const { logger } = await import("@/utils/logger");
    logger.error(
      "[instrumentation] MongoDB warmup failed",
      error instanceof Error ? error : new Error(String(error)),
    );
  }
}
