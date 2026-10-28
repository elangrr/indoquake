"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback } from "react";
import type { StatisticsResponse } from "@/lib/api-types";
import { bucketLabel, columnOption, rowOption, type ChartColors } from "@/lib/chart-options";
import { PERIODS, type PeriodId } from "@/lib/period";
import { useApi } from "@/lib/use-api";
import { ChartBlock, type ChartRow } from "./chart-block";
import { ErrorState } from "./error-state";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

function monthLabel(month: string): string {
  const [year, index] = month.split("-");
  return `${MONTHS[Number(index) - 1]} ${year}`;
}

function dayLabel(date: string): string {
  const [, month, day] = date.split("-");
  return `${Number(day)} ${MONTHS[Number(month) - 1]}`;
}

function describe(rows: ChartRow[], unit: string): string {
  if (rows.length === 0) return "Tidak ada data.";
  const top = rows.reduce((best, row) => (row.count > best.count ? row : best), rows[0]);
  const total = rows.reduce((sum, row) => sum + row.count, 0);
  return `${total.toLocaleString("id-ID")} gempa; terbanyak ${top.label} (${top.count.toLocaleString("id-ID")} ${unit}).`;
}

function useBuild(rows: ChartRow[], kind: "column" | "row") {
  return useCallback(
    (colors: ChartColors) =>
      (kind === "column" ? columnOption : rowOption)(
        rows.map((row) => row.label),
        rows.map((row) => row.count),
        colors,
      ),
    [rows, kind],
  );
}

function Block({ title, rows, kind, height }: { title: string; rows: ChartRow[]; kind: "column" | "row"; height?: number }) {
  const build = useBuild(rows, kind);
  return <ChartBlock title={title} rows={rows} build={build} height={height} summary={describe(rows, "gempa")} />;
}

function fmt(value: number | null, digits = 1): string {
  return value === null ? "Tidak ada" : value.toLocaleString("id-ID", { maximumFractionDigits: digits, minimumFractionDigits: digits });
}

function StatsBody({ data }: { data: StatisticsResponse["data"] }) {
  const s = data.summary;
  const facts = [
    { label: "Jumlah gempa", value: s.total.toLocaleString("id-ID") },
    { label: "Terkuat", value: s.strongestMagnitude === null ? "Tidak ada" : `M${s.strongestMagnitude.toFixed(1)}` },
    { label: "Dirasakan", value: s.countFelt.toLocaleString("id-ID") },
    { label: "Berpotensi tsunami", value: s.countTsunami.toLocaleString("id-ID") },
    { label: "Rata rata kedalaman", value: s.averageDepthKm === null ? "Tidak ada" : `${fmt(s.averageDepthKm)} km` },
    { label: "Rata rata magnitudo", value: fmt(s.averageMagnitude) },
  ];
  const byDay = data.byDay.map((item) => ({ label: dayLabel(item.date), count: item.count }));
  const byMonth = data.byMonth?.map((item) => ({ label: monthLabel(item.month), count: item.count }));
  const magnitude = data.magnitudeDistribution.map((item) => ({ label: bucketLabel(item.label), count: item.count }));
  const depth = data.depthDistribution.map((item) => ({ label: `${bucketLabel(item.label)}${/km/.test(item.label) ? "" : " km"}`, count: item.count }));
  const byHour = data.byHour.map((count, hour) => ({ label: `${String(hour).padStart(2, "0")}:00`, count }));
  const byProvince = data.byProvince.filter((item) => item.count > 0).map((item) => ({ label: item.name, count: item.count }));

  return (
    <>
      <dl data-testid="stats-summary" className="grid grid-cols-2 border-t border-border sm:grid-cols-3 lg:grid-cols-6">
        {facts.map((fact) => (
          <div key={fact.label} className="border-b border-border px-4 py-4 sm:border-r">
            <dt className="text-xs text-muted">{fact.label}</dt>
            <dd className="num mt-1 text-2xl font-semibold text-foreground">{fact.value}</dd>
          </div>
        ))}
      </dl>
      <div className="lg:grid lg:grid-cols-2">
        <Block title="Gempa per hari (30 hari terakhir, WIB)" rows={byDay} kind="column" />
        {byMonth && byMonth.length > 0 && <Block title="Gempa per bulan (12 bulan, WIB)" rows={byMonth} kind="column" />}
        <Block title="Sebaran magnitudo" rows={magnitude} kind="row" />
        <Block title="Sebaran kedalaman" rows={depth} kind="row" />
        <Block title="Jam kejadian (WIB)" rows={byHour} kind="column" />
        <Block title="Per provinsi" rows={byProvince} kind="row" height={Math.max(160, byProvince.length * 32)} />
      </div>
    </>
  );
}

export function StatsView() {
  const params = useSearchParams();
  const period: PeriodId = PERIODS.find((item) => item.id === params.get("period"))?.id ?? "30d";
  const result = useApi<StatisticsResponse>(`/api/v1/statistics?period=${period}`);

  return (
    <>
      <nav aria-label="Periode" className="flex flex-wrap gap-2 px-4 pb-6">
        {PERIODS.map((item) => (
          <Link
            key={item.id}
            href={item.id === "30d" ? "/statistik" : `/statistik?period=${item.id}`}
            aria-current={item.id === period ? "page" : undefined}
            className={`inline-flex min-h-11 items-center rounded-sm border px-4 text-sm transition-colors duration-150 ${
              item.id === period
                ? "border-foreground bg-foreground text-background"
                : "border-border text-muted hover:border-foreground hover:text-foreground"
            }`}
          >
            {item.label}
          </Link>
        ))}
      </nav>
      <div aria-busy={result.status === "loading"}>
        {result.status === "loading" && <StatsSkeleton />}
        {result.status === "error" && (
          <div className="px-4 pb-8">
            <ErrorState onRetry={result.retry} />
          </div>
        )}
        {result.status === "ready" && <StatsBody data={result.data.data} />}
      </div>
    </>
  );
}

function StatsSkeleton() {
  return (
    <div aria-hidden="true" data-testid="stats-skeleton">
      <div className="grid grid-cols-2 border-t border-border sm:grid-cols-3 lg:grid-cols-6">
        {Array.from({ length: 6 }, (_, index) => (
          <div key={index} className="h-20 border-b border-border px-4 py-4 sm:border-r">
            <div className="h-3 w-20 rounded-sm bg-surface-2" />
            <div className="mt-3 h-6 w-16 rounded-sm bg-surface-2" />
          </div>
        ))}
      </div>
      <div className="h-72 border-t border-border bg-surface-2/40" />
    </div>
  );
}
