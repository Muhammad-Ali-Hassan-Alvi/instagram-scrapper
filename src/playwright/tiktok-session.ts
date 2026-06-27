import type { Cookie } from "playwright";

export const TIKTOK_AUTH_COOKIE_NAMES = [
  "sessionid",
  "sid_tt",
  "uid_tt",
  "ssid_ucp_v1",
] as const;

export interface TikTokBrowserExport {
  cookies: Array<{
    name: string;
    value: string;
    domain: string;
    path?: string;
    expires?: string | number | "Session";
    httpOnly?: boolean;
    secure?: boolean;
    sameSite?: "Strict" | "Lax" | "None" | string;
  }>;
  localStorage?: Record<string, string>;
  sessionStorage?: Record<string, string>;
}

export interface PlaywrightStorageState {
  cookies: Cookie[];
  origins: Array<{
    origin: string;
    localStorage: Array<{ name: string; value: string }>;
  }>;
}

function parseExpires(expires: TikTokBrowserExport["cookies"][number]["expires"]): number {
  if (expires == null || expires === "Session") {
    return Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 365;
  }
  if (typeof expires === "number") return expires;
  const ms = Date.parse(expires);
  return Number.isNaN(ms) ? Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 365 : Math.floor(ms / 1000);
}

function normalizeSameSite(value: string | undefined): "Strict" | "Lax" | "None" {
  if (value === "Strict" || value === "None") return value;
  return "Lax";
}

export function hasTikTokAuthCookies(
  cookies: Array<{ name: string; value: string }> | undefined,
): boolean {
  if (!cookies?.length) return false;

  return cookies.some((cookie) => {
    if (!TIKTOK_AUTH_COOKIE_NAMES.includes(cookie.name as (typeof TIKTOK_AUTH_COOKIE_NAMES)[number])) {
      return false;
    }
    if (cookie.name === "ssid_ucp_v1") return cookie.value.length > 20;
    return cookie.value.length > 8;
  });
}

export function buildPlaywrightStorageState(exportData: TikTokBrowserExport): PlaywrightStorageState {
  const cookies: Cookie[] = exportData.cookies.map((cookie) => ({
    name: cookie.name,
    value: cookie.value,
    domain: cookie.domain,
    path: cookie.path ?? "/",
    expires: parseExpires(cookie.expires),
    httpOnly: cookie.httpOnly ?? false,
    secure: cookie.secure ?? true,
    sameSite: normalizeSameSite(cookie.sameSite),
  }));

  const localStorage = Object.entries(exportData.localStorage ?? {}).map(([name, value]) => ({
    name,
    value,
  }));

  return {
    cookies,
    origins: localStorage.length
      ? [{ origin: "https://www.tiktok.com", localStorage }]
      : [],
  };
}
