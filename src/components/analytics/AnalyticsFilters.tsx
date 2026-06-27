"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";

import { accountLabel, parseAccountKey } from "@/lib/account-route";
import { ui } from "@/lib/ui-classes";
import type { AnalyticsSnapshot } from "@/types/analytics";

export function AnalyticsFilters({ snapshot }: { snapshot: AnalyticsSnapshot }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function update(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === "all") {
      params.delete(key);
    } else {
      params.set(key, value);
    }
    if (key !== "page" && key !== "pageSize") {
      params.delete("page");
    }
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="flex flex-wrap gap-3">
      <FilterSelect
        label="Platform"
        value={snapshot.filters.platform}
        onChange={(value) => update("platform", value)}
        options={[
          { value: "all", label: "All" },
          { value: "instagram", label: "Instagram" },
          { value: "tiktok", label: "TikTok" },
        ]}
      />
      <FilterSelect
        label="Sort by"
        value={snapshot.filters.metric}
        onChange={(value) => update("metric", value)}
        options={[
          { value: "engagement", label: "Engagement" },
          { value: "views", label: "Views" },
          { value: "likes", label: "Likes" },
          { value: "comments", label: "Comments" },
          { value: "shares", label: "Shares" },
        ]}
      />
      <FilterSelect
        label="Account"
        value={snapshot.filters.account}
        onChange={(value) => update("account", value)}
        options={[
          { value: "all", label: "All accounts" },
          ...snapshot.availableAccounts.map((key) => {
            const parsed = parseAccountKey(key);
            return {
              value: key,
              label: parsed ? accountLabel(parsed.platform, parsed.username) : key,
            };
          }),
        ]}
      />
      <FilterSelect
        label="Year"
        value={snapshot.filters.year}
        onChange={(value) => update("year", value)}
        options={[
          { value: "all", label: "All years" },
          ...snapshot.availableYears.map((year) => ({
            value: String(year),
            label: String(year),
          })),
        ]}
      />
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="flex items-center gap-2 text-xs font-medium text-slate-600">
      {label}
      <select className={ui.input} value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
