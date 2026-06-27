import { getAnalyticsSnapshot } from "@/services/analytics";

export async function loadAnalyticsSnapshot(
  searchParams: Promise<Record<string, string | undefined>> | Record<string, string | undefined>,
) {
  const params =
    searchParams instanceof Promise ? await searchParams : searchParams;
  return getAnalyticsSnapshot(params);
}
