"use client";

import { useSearchParams } from "next/navigation";
import type { EarthquakeListResponse } from "@indoquake/shared";
import { PROVINCE_GROUPS, provinceBySlug } from "@indoquake/regions/meta";
import { historyApiQuery, historyPageHref, parseHistoryFilters } from "@/lib/history-query";
import { useApi } from "@/lib/use-api";
import { ErrorState } from "./error-state";
import { EventList, EventListSkeleton } from "./event-list";
import { Pager } from "./pager";

const field =
  "mt-1 block min-h-11 w-full rounded-sm border border-border bg-surface px-3 text-base text-foreground";
const label = "text-sm text-muted";

export function HistoryView() {
  const params = useSearchParams();
  const filters = parseHistoryFilters(params);
  const result = useApi<EarthquakeListResponse>(`/api/v1/earthquakes?${historyApiQuery(filters)}`);

  return (
    <>
      <form method="get" action="/riwayat" className="grid grid-cols-2 gap-4 px-4 pb-6 sm:grid-cols-4 lg:grid-cols-6">
        <label className={`${label} col-span-2`}>
          Wilayah
          <input name="q" type="search" defaultValue={filters.q} maxLength={60} className={field} />
        </label>
        <label className={label}>
          Magnitudo min
          <input name="minMag" inputMode="decimal" defaultValue={filters.minMag} className={field} />
        </label>
        <label className={label}>
          Magnitudo maks
          <input name="maxMag" inputMode="decimal" defaultValue={filters.maxMag} className={field} />
        </label>
        <label className={label}>
          Kedalaman min (km)
          <input name="minDepth" inputMode="numeric" defaultValue={filters.minDepth} className={field} />
        </label>
        <label className={label}>
          Kedalaman maks (km)
          <input name="maxDepth" inputMode="numeric" defaultValue={filters.maxDepth} className={field} />
        </label>
        <label className={label}>
          Dari tanggal (WIB)
          <input name="from" type="date" defaultValue={filters.from} className={field} />
        </label>
        <label className={label}>
          Sampai tanggal (WIB)
          <input name="to" type="date" defaultValue={filters.to} className={field} />
        </label>
        <label className={`${label} col-span-2`}>
          Provinsi
          <select name="province" defaultValue={filters.province} className={field}>
            <option value="">Semua provinsi</option>
            {PROVINCE_GROUPS.map((group) => (
              <optgroup key={group.name} label={group.name}>
                {group.slugs.map((slug) => (
                  <option key={slug} value={slug}>
                    {provinceBySlug(slug)?.name}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>
        <label className={`${label} col-span-2`}>
          Wilayah
          <select name="area" defaultValue={filters.area} className={field}>
            <option value="">Semua</option>
            <option value="land">Darat</option>
            <option value="sea">Laut dan perairan</option>
          </select>
        </label>
        <div className="col-span-2 flex flex-wrap items-end gap-4">
          <label className="flex min-h-11 items-center gap-2 text-sm text-foreground">
            <input name="felt" type="checkbox" value="1" defaultChecked={filters.felt} className="h-5 w-5 accent-[var(--signal)]" />
            Dirasakan
          </label>
          <label className="flex min-h-11 items-center gap-2 text-sm text-foreground">
            <input name="tsunami" type="checkbox" value="1" defaultChecked={filters.tsunami} className="h-5 w-5 accent-[var(--signal)]" />
            Berpotensi tsunami
          </label>
        </div>
        <div className="col-span-2 flex items-end gap-2 sm:col-span-4 lg:col-span-6">
          <button type="submit" className="min-h-11 rounded-sm bg-foreground px-6 text-sm font-medium text-background">
            Terapkan
          </button>
          <a href="/riwayat" className="inline-flex min-h-11 items-center px-4 text-sm text-muted underline underline-offset-4 hover:text-foreground">
            Hapus filter
          </a>
        </div>
      </form>

      <div aria-live="polite" aria-busy={result.status === "loading"}>
        {result.status === "loading" && <EventListSkeleton />}
        {result.status === "error" && (
          <div className="px-4 pb-8">
            <ErrorState onRetry={result.retry} />
          </div>
        )}
        {result.status === "ready" && (
          <>
            <p className="num px-4 pb-2 text-sm text-muted" data-testid="history-count">
              {(result.data.meta.total ?? result.data.meta.count).toLocaleString("id-ID")} gempa
            </p>
            {result.data.data.length === 0 ? (
              <p className="border-t border-border px-4 py-8 text-base text-foreground">
                Tidak ada gempa yang cocok dengan filter ini.
              </p>
            ) : (
              <EventList events={result.data.data} />
            )}
            <Pager
              page={result.data.meta.page ?? filters.page}
              totalPages={result.data.meta.totalPages ?? 1}
              hrefFor={(page) => historyPageHref(params, page)}
            />
          </>
        )}
      </div>
    </>
  );
}
