"use client";

import dynamic from "next/dynamic";
import { useRouter, useSearchParams } from "next/navigation";
import type { EarthquakeEvent, EarthquakeListResponse } from "@indoquake/shared";
import { useApi, type ApiState } from "@/lib/use-api";
import { useIdle } from "@/lib/use-idle";
import { ErrorState } from "./error-state";
import { EventList, EventListSkeleton } from "./event-list";
import { MapPlaceholder } from "./map-placeholder";
import { Pager } from "./pager";

const EarthquakeMap = dynamic(() => import("./earthquake-map").then((module) => module.EarthquakeMap), {
  ssr: false,
  loading: () => <MapPlaceholder />,
});

function pageOf(value: string | null): number {
  return Math.max(1, Math.trunc(Number(value ?? "1")) || 1);
}

function EventsBlock({
  result,
  page,
  emptyText,
  hrefFor,
}: {
  result: ApiState<EarthquakeListResponse> & { retry: () => void };
  page: number;
  emptyText: string;
  hrefFor: (page: number) => string;
}) {
  if (result.status === "loading") return <EventListSkeleton rows={3} />;
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
        <p className="border-t border-border px-4 py-8 text-base text-foreground">{emptyText}</p>
      ) : (
        <EventList events={data} />
      )}
      <Pager page={meta.page ?? page} totalPages={meta.totalPages ?? 1} hrefFor={hrefFor} />
    </>
  );
}

/**
 * Province page body (AC 30): land events (API province=slug), sea events near the province
 * (API nearProvince=slug) and a small lazy map with the province outline. The headings are in the
 * server HTML; the lists load in the browser.
 */
export function ProvinceView({ slug, name }: { slug: string; name: string }) {
  const params = useSearchParams();
  const router = useRouter();
  const idle = useIdle();
  const page = pageOf(params.get("page"));
  const seaPage = pageOf(params.get("laut"));
  const land = useApi<EarthquakeListResponse>(
    "/api/v1/earthquakes?province=" + encodeURIComponent(slug) + "&page=" + page + "&limit=50",
  );
  const sea = useApi<EarthquakeListResponse>(
    "/api/v1/earthquakes?nearProvince=" + encodeURIComponent(slug) + "&page=" + seaPage + "&limit=50",
  );
  const href = (nextLand: number, nextSea: number) => {
    const query = new URLSearchParams();
    if (nextLand > 1) query.set("page", String(nextLand));
    if (nextSea > 1) query.set("laut", String(nextSea));
    const text = query.toString();
    return "/provinsi/" + slug + (text ? "?" + text : "");
  };
  const mapEvents: EarthquakeEvent[] = [
    ...(land.status === "ready" ? land.data.data : []),
    ...(sea.status === "ready" ? sea.data.data : []),
  ];

  return (
    <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,28rem)] lg:gap-8">
      <div className="min-w-0">
        <section aria-labelledby="gempa-darat" className="pb-8">
          <h2 id="gempa-darat" className="px-4 pb-2 text-xl font-semibold text-foreground">
            Di darat
          </h2>
          <EventsBlock
            result={land}
            page={page}
            emptyText="Belum ada gempa tercatat di provinsi ini."
            hrefFor={(next) => href(next, seaPage)}
          />
        </section>
        <section aria-labelledby="gempa-perairan" className="pb-8">
          <h2 id="gempa-perairan" className="px-4 pb-2 text-xl font-semibold text-foreground">
            Perairan dekat {name}
          </h2>
          <EventsBlock
            result={sea}
            page={seaPage}
            emptyText="Belum ada gempa tercatat di perairan dekat provinsi ini."
            hrefFor={(next) => href(page, next)}
          />
        </section>
      </div>
      <div
        role="region"
        aria-label={"Peta " + name}
        className="relative h-72 border-y border-border lg:sticky lg:top-4 lg:h-[28rem] lg:self-start"
      >
        {idle ? (
          <EarthquakeMap
            events={mapEvents}
            selectedKey={null}
            onSelect={(eventKey) => router.push("/gempa/" + eventKey)}
            userLocation={null}
            nearActive={false}
            radiusKm={0}
            replay={null}
            feltLocations={[]}
            epicenter={null}
            feltRadiusKm={null}
            province={slug}
          />
        ) : (
          <MapPlaceholder />
        )}
      </div>
    </div>
  );
}
