"use client";

import { useSearchParams } from "next/navigation";
import type { EarthquakeListResponse } from "@indoquake/shared";
import { useApi } from "@/lib/use-api";
import { ErrorState } from "./error-state";
import { EventList, EventListSkeleton } from "./event-list";
import { Pager } from "./pager";

export function ProvinceEvents({ slug }: { slug: string }) {
  const params = useSearchParams();
  const page = Math.max(1, Math.trunc(Number(params.get("page") ?? "1")) || 1);
  const result = useApi<EarthquakeListResponse>(
    `/api/v1/earthquakes?province=${encodeURIComponent(slug)}&page=${page}&limit=50`,
  );
  if (result.status === "loading") return <EventListSkeleton />;
  if (result.status === "error") {
    return (
      <div className="px-4 pb-8">
        <ErrorState onRetry={result.retry} />
      </div>
    );
  }
  const { data, meta } = result.data;
  return (
    <>
      <p className="num px-4 pb-2 text-sm text-muted">{(meta.total ?? meta.count).toLocaleString("id-ID")} gempa</p>
      {data.length === 0 ? (
        <p className="border-t border-border px-4 py-8 text-base text-foreground">Belum ada gempa tercatat di provinsi ini.</p>
      ) : (
        <EventList events={data} />
      )}
      <Pager
        page={meta.page ?? page}
        totalPages={meta.totalPages ?? 1}
        hrefFor={(next) => (next > 1 ? `/provinsi/${slug}?page=${next}` : `/provinsi/${slug}`)}
      />
    </>
  );
}
