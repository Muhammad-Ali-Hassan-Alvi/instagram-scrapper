import { config } from "dotenv";
import { z } from "zod";

config({ path: ".env.local", override: true });
config();

const envSchema = z.object({
  MONGODB_URI: z.string().min(1).optional(),
  MONGO_URI: z.string().min(1).optional(),
  INSTAGRAM_USERNAME: z.string().min(1).optional(),
  INSTAGRAM_PASSWORD: z.string().min(1).optional(),
  INSTAGRAM_EMAIL_CODE: z.string().min(4).max(12).optional(),
  INSTAGRAM_SESSION_ONLY: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => v === "true")
    .default(false),
  TIKTOK_USERNAME: z.string().min(1).optional(),
  TIKTOK_PASSWORD: z.string().min(1).optional(),
  SCRAPE_HEADLESS: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => v !== "false"),
  SCRAPE_MIN_DELAY_MS: z.coerce.number().min(500).optional().default(1500),
  SCRAPE_MAX_DELAY_MS: z.coerce.number().min(500).optional().default(3500),
  CRON_SCHEDULE: z.string().min(1).optional().default("0 6 * * *"),
  CRON_TZ: z.string().min(1).optional().default("UTC"),
  CRON_SECRET: z.string().min(1).optional(),
  RUN_SCRAPE_ON_START: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => v === "true")
    .default(false),
  AUTO_SCRAPE_ON_VISIT: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => v === "true")
    .default(false),
  SCRAPE_STALE_HOURS: z.coerce.number().min(1).optional().default(24),
  APIFY_TOKEN: z.string().min(1).optional(),
  APIFY_TIKTOK_ACTOR: z.string().min(1).optional(),
  APIFY_INSTAGRAM_ACTOR: z.string().min(1).optional(),
});

export type Env = z.infer<typeof envSchema> & {
  MONGODB_URI: string;
};

let cachedEnv: Env | null = null;

function resolveMongoUri(parsed: z.infer<typeof envSchema>): string {
  // Prefer MONGO_URI — avoids a stale system-level MONGODB_URI overriding .env.local
  const uri = parsed.MONGO_URI ?? parsed.MONGODB_URI;
  if (!uri) {
    throw new Error("Invalid environment variables:\nMONGO_URI: Required (or set MONGODB_URI)");
  }
  return uri;
}

/**
 * Validates and returns environment variables.
 * Cached after first successful parse.
 */
export function getEnv(): Env {
  if (!cachedEnv) {
    const result = envSchema.safeParse(process.env);

    if (!result.success) {
      const formatted = result.error.issues
        .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
        .join("\n");
      throw new Error(`Invalid environment variables:\n${formatted}`);
    }

    cachedEnv = {
      ...result.data,
      MONGODB_URI: resolveMongoUri(result.data),
    };
  }

  return cachedEnv;
}

export function hasInstagramCredentials(): boolean {
  const env = getEnv();
  return Boolean(env.INSTAGRAM_USERNAME && env.INSTAGRAM_PASSWORD);
}

export function hasTikTokCredentials(): boolean {
  const env = getEnv();
  return Boolean(env.TIKTOK_USERNAME && env.TIKTOK_PASSWORD);
}
