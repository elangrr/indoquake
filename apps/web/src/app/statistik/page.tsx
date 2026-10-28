import Link from "next/link";
import type { ReactNode } from "react";
import type { EarthquakeEvent } from "@indoquake/shared";
import {
  countByDay,
  countByHour,
  countByProvince,
  depthDistribution,
  magnitudeDistribution,
  summarize,
} from "@indoquake/earthquake";
import { listEarthquakes } from "@/lib/queries";
import { PROVINCE_OPTIONS } from "@indoquake/regions";
import { parsePeriod, PERIODS } from "@/lib/period";
import {
  barChartOption,
  horizontalBarChartOption,
  lineChartOption,
  scatterChartOption,
} from "@/lib/chart-options";
import { Chart } from "@/components/chart";

export const dynamic = "force-dynamic";

const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;
const MONTH_LABELS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "Mei",
  "Jun",
  "Jul",
  "Agu",
  "Sep",
  "Okt",
  "Nov",
  "Des",
];

function monthBuckets(events: EarthquakeEvent[], months = 12) {
  const reference = new Date(Date.now() + WIB_OFFSET_MS);
  const buckets: {
    key: string;
    label: string;
    count: number;
    fromUtc: string;
    toUtc: string;
  }[] = [];

  for (let offset = months - 1; offset >= 0; offset -= 1) {
    const start = new Date(
      Date.UTC(reference.getUTCFullYear(), reference.getUTCMonth() - offset, 1),
    );
    const end = new Date(
      Date.UTC(reference.getUTCFullYear(), reference.getUTCMonth() - offset + 1, 1),
    );
    const key = start.toISOString().slice(0, 7);
    buckets.push({
      key,
      label: `${MONTH_LABELS[start.getUTCMonth()]} ${start.getUTCFullYear()}`,
      count: 0,
      fromUtc: new Date(start.getTime() - WIB_OFFSET_MS).toISOString(),
      toUtc: new Date(end.getTime() - WIB_OFFSET_MS).toISOString(),
    });
  }

  const index = new Map(buckets.map((bucket, position) => [bucket.key, position]));
  for (const event of events) {
    const key = new Date(new Date(event.eventTimeUtc).getTime() + WIB_OFFSET_MS)
      .toISOString()
      .slice(0, 7);
    const position = index.get(key);
    if (position !== undefined) buckets[position].count += 1;
  }
  return buckets;
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface px-3 py-2">
      <p className="text-xs uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-0.5 text-sm font-semibold text-foreground">{value}</p>
    </div>
  );
}

function Panel({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-lg border border-border bg-surface p-3">
      <h2 className="text-xs font-semibold tracking-wide text-foreground">
        {title}
      </h2>
      <div className="mt-2">{children}</div>
    </section>
  );
}

export default async function StatistikPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const params = await searchParams;
  const period = parsePeriod(params.period);

  const events = await listEarthquakes({
    limit: 5000,
    fromUtc: period.fromUtc ?? undefined,
  });

  const summary = summarize(events);
  const magnitude = magnitudeDistribution(events);
  const depth = depthDistribution(events);
  const byDay = countByDay(events, 30);
  const byHour = countByHour(events);
  const byProvince = countByProvince(events, PROVINCE_OPTIONS);
  const months = monthBuckets(events, 12);

  return (
    <div className="mx-auto min-h-0 w-full max-w-5xl flex-1 overflow-y-auto px-4 py-6">
      <h1 className="text-lg font-semibold text-foreground">
        Statistik Gempa
      </h1>
      <p className="mt-1 text-xs text-muted">
        Agregasi dari data resmi BMKG yang tersimpan. Angka bukan prediksi.
      </p>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {PERIODS.map((item) => (
          <Link
            key={item.id}
            href={`/statistik?period=${item.id}`}
            className={
              item.id === period.id
                ? "rounded-full border border-accent bg-accent/10 px-2.5 py-1 text-xs text-accent"
                : "rounded-full border border-border px-2.5 py-1 text-xs text-muted hover:text-foreground"
            }
          >
            {item.label}
          </Link>
        ))}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        <StatCard label="Total gempa" value={summary.total.toLocaleString("id-ID")} />
        <StatCard label="M3+" value={summary.countM3.toLocaleString("id-ID")} />
        <StatCard label="M4+" value={summary.countM4.toLocaleString("id-ID")} />
        <StatCard label="M5+" value={summary.countM5.toLocaleString("id-ID")} />
        <StatCard
          label="Terkuat"
          value={
            summary.strongestMagnitude === null
              ? "—"
              : `M${summary.strongestMagnitude.toFixed(1)}`
          }
        />
        <StatCard
          label="Terdalam"
          value={summary.deepestKm === null ? "—" : `${summary.deepestKm} km`}
        />
        <StatCard
          label="Rata-rata magnitudo"
          value={
            summary.averageMagnitude === null
              ? "—"
              : summary.averageMagnitude.toFixed(2)
          }
        />
        <StatCard
          label="Rata-rata kedalaman"
          value={
            summary.averageDepthKm === null
              ? "—"
              : `${summary.averageDepthKm} km`
          }
        />
        <StatCard
          label="Dirasakan"
          value={summary.countFelt.toLocaleString("id-ID")}
        />
        <StatCard
          label="Potensi tsunami"
          value={summary.countTsunami.toLocaleString("id-ID")}
        />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
        <Panel title="DISTRIBUSI MAGNITUDO">
          <Chart
            option={barChartOption(
              magnitude.map((bucket) => bucket.label),
              magnitude.map((bucket) => bucket.count),
              "#38bdf8",
            )}
          />
        </Panel>
        <Panel title="DISTRIBUSI KEDALAMAN (KM)">
          <Chart
            option={barChartOption(
              depth.map((bucket) => bucket.label),
              depth.map((bucket) => bucket.count),
              "#a3e635",
            )}
          />
        </Panel>
        <Panel title="TREN 30 HARI TERAKHIR">
          <Chart
            option={lineChartOption(
              byDay.map((day) => day.date.slice(5)),
              byDay.map((day) => day.count),
              "#38bdf8",
            )}
          />
        </Panel>
        <Panel title="AKTIVITAS PER JAM (WIB)">
          <Chart
            option={barChartOption(
              byHour.map((_, hour) => String(hour).padStart(2, "0")),
              byHour,
              "#fbbf24",
            )}
          />
        </Panel>
        <Panel title="GEMPA PER PROVINSI">
          <Chart
            height={260}
            option={horizontalBarChartOption(
              byProvince.map((item) => item.name),
              byProvince.map((item) => item.count),
              "#f97316",
            )}
          />
        </Panel>
        <Panel title="MAGNITUDO VS KEDALAMAN">
          <Chart
            height={260}
            option={scatterChartOption(
              events.map((event) => [event.magnitude, event.depthKm]),
              "#38bdf8",
            )}
          />
        </Panel>
      </div>

      <Panel title="TIMELINE BULANAN (12 BULAN)">
        <ul className="flex flex-wrap gap-1.5">
          {months.map((month) => (
            <li key={month.key}>
              <Link
                href={`/riwayat?from=${month.fromUtc.slice(0, 10)}&to=${new Date(
                  new Date(month.toUtc).getTime() - 86400000,
                )
                  .toISOString()
                  .slice(0, 10)}`}
                className="flex items-center gap-2 rounded-full border border-border px-2.5 py-1 text-xs text-muted hover:border-accent hover:text-accent"
              >
                <span className="text-foreground">{month.label}</span>
                <span>{month.count}</span>
              </Link>
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}
