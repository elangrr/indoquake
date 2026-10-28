"use client";

import Link from "next/link";
import type { StatisticsResponse } from "@/lib/api-types";
import { useApi } from "@/lib/use-api";
import { ErrorState } from "./error-state";

export function ProvinceList({ provinces }: { provinces: readonly { slug: string; name: string }[] }) {
  const result = useApi<StatisticsResponse>("/api/v1/statistics?period=all");
  const counts = new Map(
    result.status === "ready" ? result.data.data.byProvince.map((item) => [item.slug, item.count] as const) : [],
  );
  return (
    <>
      {result.status === "error" && (
        <div className="px-4 pb-6">
          <ErrorState onRetry={result.retry} />
        </div>
      )}
      <ul className="border-t border-border" aria-busy={result.status === "loading"}>
        {provinces.map((province) => (
          <li key={province.slug} className="border-b border-border">
            <Link
              href={`/provinsi/${province.slug}`}
              className="flex min-h-14 items-center justify-between gap-4 px-4 transition-colors duration-150 hover:bg-surface-2"
            >
              <span className="text-base text-foreground">{province.name}</span>
              <span className="num text-sm text-muted" data-testid={`count-${province.slug}`}>
                {result.status === "ready" ? `${(counts.get(province.slug) ?? 0).toLocaleString("id-ID")} gempa` : ""}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
