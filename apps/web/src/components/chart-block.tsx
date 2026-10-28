import type { EChartsCoreOption } from "echarts/core";
import type { ChartColors } from "@/lib/chart-options";
import { Chart } from "./chart";

export interface ChartRow {
  label: string;
  count: number;
}

/** A titled chart with its numbers in a user-opened table. */
export function ChartBlock({
  title,
  rows,
  build,
  height,
  summary,
}: {
  title: string;
  rows: ChartRow[];
  build: (colors: ChartColors) => EChartsCoreOption;
  height?: number;
  summary: string;
}) {
  return (
    <section className="border-t border-border px-4 py-6">
      <h2 className="text-base font-semibold text-foreground">{title}</h2>
      <div className="mt-3">
        <Chart build={build} height={height} label={`${title}. ${summary}`} />
      </div>
      <details className="mt-2">
        <summary className="inline-flex min-h-11 cursor-pointer items-center text-sm text-muted hover:text-foreground">
          Lihat tabel
        </summary>
        <table className="num mt-2 w-full max-w-md text-sm">
          <thead>
            <tr className="text-left text-xs text-muted">
              <th scope="col" className="py-1 font-medium">
                {title}
              </th>
              <th scope="col" className="py-1 text-right font-medium">
                Jumlah
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.label} className="border-t border-border">
                <td className="py-1">{row.label}</td>
                <td className="py-1 text-right">{row.count.toLocaleString("id-ID")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </section>
  );
}
