import Link from "next/link";
import { listEarthquakes } from "@/lib/queries";
import { PROVINCE_OPTIONS } from "@indoquake/regions";
import { formatMagnitude, magnitudeColor } from "@/lib/magnitude";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

interface HistorySearchParams {
  q?: string;
  minMag?: string;
  maxMag?: string;
  minDepth?: string;
  maxDepth?: string;
  from?: string;
  to?: string;
  felt?: string;
  tsunami?: string;
  province?: string;
  page?: string;
}

function toNumber(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function wibStart(date: string): string {
  return new Date(`${date}T00:00:00+07:00`).toISOString();
}

function wibEnd(date: string): string {
  return new Date(`${date}T23:59:59+07:00`).toISOString();
}

function pageHref(params: HistorySearchParams, page: number): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (key === "page" || !value) continue;
    search.set(key, value);
  }
  if (page > 1) search.set("page", String(page));
  const query = search.toString();
  return query ? `/riwayat?${query}` : "/riwayat";
}

const inputClass =
  "mt-1 w-full rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground outline-none focus:border-accent";

export default async function RiwayatPage({
  searchParams,
}: {
  searchParams: Promise<HistorySearchParams>;
}) {
  const params = await searchParams;
  const pageParam = Math.max(1, Math.trunc(toNumber(params.page) ?? 1));

  const events = await listEarthquakes({
    limit: 3000,
    minMagnitude: toNumber(params.minMag),
    maxMagnitude: toNumber(params.maxMag),
    minDepthKm: toNumber(params.minDepth),
    maxDepthKm: toNumber(params.maxDepth),
    fromUtc: params.from ? wibStart(params.from) : undefined,
    toUtc: params.to ? wibEnd(params.to) : undefined,
    feltOnly: params.felt === "1",
    tsunamiOnly: params.tsunami === "1",
    provinceSlug: params.province || undefined,
  });

  const query = (params.q ?? "").trim().toLowerCase();
  const filtered = query
    ? events.filter((event) => event.regionName.toLowerCase().includes(query))
    : events;

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const page = Math.min(pageParam, totalPages);
  const items = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="mx-auto min-h-0 w-full max-w-5xl flex-1 overflow-y-auto px-4 py-6">
      <h1 className="text-lg font-semibold text-foreground">
        Riwayat Gempa
      </h1>
      <p className="mt-1 text-xs text-muted">
        Data resmi BMKG yang tersimpan sejak sistem berjalan. Sumber data: BMKG.
      </p>

      <form
        method="get"
        className="mt-4 grid grid-cols-2 gap-3 rounded-lg border border-border bg-surface p-3 sm:grid-cols-4"
      >
        <label className="col-span-2 text-[11px] text-muted sm:col-span-4">
          Cari wilayah
          <input
            name="q"
            defaultValue={params.q ?? ""}
            placeholder="mis. Bandung, Cilacap, Malang"
            className={inputClass}
          />
        </label>
        <label className="text-[11px] text-muted">
          Magnitudo min
          <input
            name="minMag"
            defaultValue={params.minMag ?? ""}
            inputMode="decimal"
            placeholder="4"
            className={inputClass}
          />
        </label>
        <label className="text-[11px] text-muted">
          Magnitudo maks
          <input
            name="maxMag"
            defaultValue={params.maxMag ?? ""}
            inputMode="decimal"
            placeholder="7"
            className={inputClass}
          />
        </label>
        <label className="text-[11px] text-muted">
          Kedalaman min (km)
          <input
            name="minDepth"
            defaultValue={params.minDepth ?? ""}
            inputMode="numeric"
            placeholder="0"
            className={inputClass}
          />
        </label>
        <label className="text-[11px] text-muted">
          Kedalaman maks (km)
          <input
            name="maxDepth"
            defaultValue={params.maxDepth ?? ""}
            inputMode="numeric"
            placeholder="700"
            className={inputClass}
          />
        </label>
        <label className="text-[11px] text-muted">
          Dari tanggal (WIB)
          <input
            type="date"
            name="from"
            defaultValue={params.from ?? ""}
            className={inputClass}
          />
        </label>
        <label className="text-[11px] text-muted">
          Sampai tanggal (WIB)
          <input
            type="date"
            name="to"
            defaultValue={params.to ?? ""}
            className={inputClass}
          />
        </label>
        <label className="text-[11px] text-muted">
          Provinsi
          <select
            name="province"
            defaultValue={params.province ?? ""}
            className={inputClass}
          >
            <option value="">Semua</option>
            {PROVINCE_OPTIONS.map((province) => (
              <option key={province.slug} value={province.slug}>
                {province.name}
              </option>
            ))}
          </select>
        </label>
        <div className="flex items-end gap-3 text-[11px] text-muted">
          <label className="flex items-center gap-1.5">
            <input
              type="checkbox"
              name="felt"
              value="1"
              defaultChecked={params.felt === "1"}
              className="h-3 w-3 accent-[#38bdf8]"
            />
            Dirasakan
          </label>
          <label className="flex items-center gap-1.5">
            <input
              type="checkbox"
              name="tsunami"
              value="1"
              defaultChecked={params.tsunami === "1"}
              className="h-3 w-3 accent-[#38bdf8]"
            />
            Potensi tsunami
          </label>
        </div>
        <div className="col-span-2 flex items-end gap-2 sm:col-span-4">
          <button
            type="submit"
            className="rounded-md border border-accent bg-accent/10 px-3 py-1.5 text-xs text-accent hover:bg-accent/20"
          >
            Terapkan filter
          </button>
          <Link
            href="/riwayat"
            className="rounded-md border border-border px-3 py-1.5 text-xs text-muted hover:text-foreground"
          >
            Reset
          </Link>
        </div>
      </form>

      <p className="mt-4 text-[11px] text-muted">
        {filtered.length.toLocaleString("id-ID")} kejadian cocok · halaman {page}{" "}
        dari {totalPages}
      </p>

      <ul className="mt-2 divide-y divide-border rounded-lg border border-border bg-surface">
        {items.length === 0 ? (
          <li className="px-4 py-6 text-center text-xs text-muted">
            Tidak ada kejadian untuk filter ini.
          </li>
        ) : (
          items.map((event) => (
            <li key={event.eventKey} className="px-4 py-2.5">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className="rounded px-1.5 py-0.5 text-[11px] font-semibold text-[#0b0f14]"
                  style={{ backgroundColor: magnitudeColor(event.magnitude) }}
                >
                  M{formatMagnitude(event.magnitude)}
                </span>
                <span className="text-[11px] text-muted">
                  {event.eventTimeWib}
                </span>
                <span className="text-[11px] text-muted">
                  · {event.depthKm} km
                </span>
                {event.provinceName && (
                  <span className="rounded-full border border-border px-2 py-0.5 text-[10px] text-muted">
                    {event.provinceName}
                  </span>
                )}
                {event.feltText && (
                  <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] text-emerald-400">
                    Dirasakan
                  </span>
                )}
                {event.tsunamiPotential === true && (
                  <span className="rounded bg-red-500/15 px-1.5 py-0.5 text-[10px] text-red-400">
                    Potensi Tsunami
                  </span>
                )}
                <Link
                  href={`/gempa/${event.eventKey}`}
                  className="ml-auto text-[11px] text-accent hover:underline"
                >
                  Detail →
                </Link>
              </div>
              <p className="mt-1 line-clamp-1 text-xs text-foreground">
                {event.regionName}
              </p>
            </li>
          ))
        )}
      </ul>

      {totalPages > 1 && (
        <div className="mt-3 flex items-center justify-between text-xs">
          <Link
            href={pageHref(params, Math.max(1, page - 1))}
            className={
              page <= 1
                ? "pointer-events-none rounded-md border border-border px-3 py-1.5 text-muted opacity-40"
                : "rounded-md border border-border px-3 py-1.5 text-foreground hover:border-accent hover:text-accent"
            }
          >
            ← Sebelumnya
          </Link>
          <span className="text-muted">
            {page} / {totalPages}
          </span>
          <Link
            href={pageHref(params, Math.min(totalPages, page + 1))}
            className={
              page >= totalPages
                ? "pointer-events-none rounded-md border border-border px-3 py-1.5 text-muted opacity-40"
                : "rounded-md border border-border px-3 py-1.5 text-foreground hover:border-accent hover:text-accent"
            }
          >
            Berikutnya →
          </Link>
        </div>
      )}
    </div>
  );
}
