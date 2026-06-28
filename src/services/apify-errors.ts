const QUOTA_PATTERNS = [
  /credit/i,
  /quota/i,
  /usage limit/i,
  /limit exceeded/i,
  /insufficient/i,
  /payment required/i,
  /plan limit/i,
  /monthly.*limit/i,
  /not enough.*compute/i,
  /exceeded.*allowance/i,
];

export function extractErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  if (error && typeof error === "object" && "message" in error) {
    return String((error as { message: unknown }).message);
  }
  return "Unknown Apify error";
}

export function isApifyQuotaError(error: unknown): boolean {
  const message = extractErrorMessage(error);
  const status =
    error && typeof error === "object" && "statusCode" in error
      ? Number((error as { statusCode: unknown }).statusCode)
      : null;

  if (status === 402) return true;

  return QUOTA_PATTERNS.some((pattern) => pattern.test(message));
}

export function formatApifyUserError(error: unknown): string {
  if (isApifyQuotaError(error)) {
    return "Your Apify account has run out of credits or reached its usage limit. Add credits on Apify or save a different API token below.";
  }

  const message = extractErrorMessage(error);
  if (/invalid.*token|unauthorized|401/i.test(message)) {
    return "Invalid Apify API token. Check the token in Apify Console → Settings → Integrations and try again.";
  }

  return message;
}
