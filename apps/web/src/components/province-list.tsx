"use client";

import Link from "next/link";
import { PROVINCE_GROUPS, provinceBySlug } from "@indoquake/regions/meta";
import type { StatisticsResponse } from "@/lib/api-types";
import { useApi } from "@/lib/use-api";
import { ErrorState } from "./error-state";

/** The 38 provinces under their 7 island groups, each with its land count (AC 30). */
export function ProvinceList() {
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
      <div aria-busy={result.status === "loading"}>
        {PROVINCE_GROUPS.map((group) => (
          <section key={group.name} aria-labelledby={"grup-" + group.slugs[0]} className="pb-6">
            <h2 id={"grup-" + group.slugs[0]} className="px-4 pb-2 text-sm font-semibold text-muted">
              {group.name}
            </h2>
            <ul className="border-t border-border">
              {group.slugs.map((slug) => (
                <li key={slug} className="border-b border-border">
                  <Link
                    href={"/provinsi/" + slug}
                    className="flex min-h-14 items-center justify-between gap-4 px-4 transition-colors duration-150 hover:bg-surface-2"
                  >
                    <span className="text-base text-foreground">{provinceBySlug(slug)?.name}</span>
                    <span className="num text-sm text-muted" data-testid={"count-" + slug}>
                      {result.status === "ready" ? (counts.get(slug) ?? 0).toLocaleString("id-ID") + " gempa" : ""}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </>
  );
}
