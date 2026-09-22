import Link from "next/link";
import { notFound } from "next/navigation";
import {
  countByDay,
  depthDistribution,
  magnitudeDistribution,
  summarize,
} from "@indoquake/earthquake";
import { listEarthquakes } from "@/lib/queries";
import { provinceBySlug } from "@indoquake/regions";
import { barChartOption, lineChartOption } from "@/lib/chart-options";
import { Chart } from "@/components/chart";
import { formatMagnitude, magnitudeColor } from "@/lib/magnitude";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const province = provinceBySlug(slug);
  if (!province) return { title: "Provinsi tidak ditemukan — Indoquake" };
  return {
    title: `Gempa ${province.name} — Indoquake`,
    description: `Riwayat dan statistik gempa bumi di ${province.name} berdasarkan data resmi BMKG.`,
  };
}

export default async function ProvincePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const province = provinceBySlug(slug);
  if (!province) notFound();

  const events = await listEarthquakes({ limit: 3000, provinceSlug: slug });
  const summary = summarize(events);
  const byDay = countByDay(events, 30);
  const magnitude = magnitudeDistribution(events);
  const depth = depthDistribution(events);
  const recent = events.slice(0, 12);

  return (
    <div className="mx-auto min-h-0 w-full max-w-5xl flex-1 overflow-y-auto px-4 py-6">
      <Link href="/provinsi" className="text-xs text-accent hover:underline">
        ← Semua provinsi
      </Link>

      <h1 className="mt-3 text-lg font-semibold text-foreground">
        Gempa di {province.name}
      </h1>
      <p className="mt-1 text-xs text-muted">
        {summary.total.toLocaleString("id-ID")} kejadian tersimpan · sumber data
        BMKG
      </p>

      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div className="rounded-lg border border-border bg-surface px-3 py-2">
          <p className="text-[10px] uppercase text-muted">Terkuat</p>
          <p className="mt-0.5 text-sm font-semibold text-foreground">
            {summary.strongestMagnitude === null
              ? "—"
              : `M${summary.strongestMagnitude.toFixed(1)}`}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-surface px-3 py-2">
          <p className="text-[10px] uppercase text-muted">Rata-rata M</p>
          <p className="mt-0.5 text-sm font-semibold text-foreground">
            {summary.averageMagnitude === null
              ? "—"
              : summary.averageMagnitude.toFixed(2)}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-surface px-3 py-2">
          <p className="text-[10px] uppercase text-muted">Rata-rata kedalaman</p>
          <p className="mt-0.5 text-sm font-semibold text-foreground">
            {summary.averageDepthKm === null ? "—" : `${summary.averageDepthKm} km`}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-surface px-3 py-2">
          <p className="text-[10px] uppercase text-muted">Dirasakan</p>
          <p className="mt-0.5 text-sm font-semibold text-foreground">
            {summary.countFelt}
          </p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
        <section className="rounded-lg border border-border bg-surface p-3">
          <h2 className="text-xs font-semibold tracking-wide text-foreground">
            TREN 30 HARI
          </h2>
          <div className="mt-2">
            <Chart
              option={lineChartOption(
                byDay.map((day) => day.date.slice(5)),
                byDay.map((day) => day.count),
                "#38bdf8",
              )}
            />
          </div>
        </section>
        <section className="rounded-lg border border-border bg-surface p-3">
          <h2 className="text-xs font-semibold tracking-wide text-foreground">
            DISTRIBUSI MAGNITUDO
          </h2>
          <div className="mt-2">
            <Chart
              option={barChartOption(
                magnitude.map((bucket) => bucket.label),
                magnitude.map((bucket) => bucket.count),
                "#38bdf8",
              )}
            />
          </div>
        </section>
        <section className="rounded-lg border border-border bg-surface p-3 lg:col-span-2">
          <h2 className="text-xs font-semibold tracking-wide text-foreground">
            DISTRIBUSI KEDALAMAN (KM)
          </h2>
          <div className="mt-2">
            <Chart
              option={barChartOption(
                depth.map((bucket) => bucket.label),
                depth.map((bucket) => bucket.count),
                "#a3e635",
              )}
            />
          </div>
        </section>
      </div>

      <section className="mt-4 rounded-lg border border-border bg-surface">
        <div className="flex items-center justify-between border-b border-border px-4 py-2">
          <h2 className="text-xs font-semibold tracking-wide text-foreground">
            KEJADIAN TERBARU
          </h2>
          <Link
            href={`/riwayat?province=${slug}`}
            className="text-[11px] text-accent hover:underline"
          >
            Lihat semua →
          </Link>
        </div>
        <ul className="divide-y divide-border">
          {recent.length === 0 ? (
            <li className="px-4 py-6 text-center text-xs text-muted">
              Belum ada kejadian tersimpan untuk provinsi ini.
            </li>
          ) : (
            recent.map((event) => (
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
      </section>
    </div>
  );
}
