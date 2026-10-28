"use client";

import { useEffect, useRef } from "react";
import type { ECharts, EChartsCoreOption } from "echarts/core";
import type { ChartColors } from "@/lib/chart-options";

interface ChartProps {
  build: (colors: ChartColors) => EChartsCoreOption;
  height?: number;
  /** Short text summary of what the chart shows; the numbers are in the "Lihat tabel" disclosure. */
  label: string;
}

const PROBE_VARS = { ink: "--ink", muted: "--ink-muted", rule: "--rule", signal: "--signal", surface: "--surface" } as const;

/** Resolves theme tokens (light-dark() values) to concrete colours for the canvas renderer. */
function themeColors(host: HTMLElement): ChartColors {
  const probe = document.createElement("span");
  host.appendChild(probe);
  const colors = {} as ChartColors;
  for (const [name, variable] of Object.entries(PROBE_VARS)) {
    probe.style.color = `var(${variable})`;
    colors[name as keyof ChartColors] = getComputedStyle(probe).color;
  }
  probe.remove();
  return colors;
}

export function Chart({ build, height = 220, label }: ChartProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<ECharts | null>(null);
  const buildRef = useRef(build);

  useEffect(() => {
    buildRef.current = build;
    const element = containerRef.current;
    if (chartRef.current && element) chartRef.current.setOption(build(themeColors(element)), true);
  }, [build]);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    let cancelled = false;
    let observer: ResizeObserver | null = null;
    const repaint = () => {
      if (chartRef.current) chartRef.current.setOption(buildRef.current(themeColors(element)), true);
    };
    const media = window.matchMedia("(prefers-color-scheme: dark)");

    void (async () => {
      const [core, charts, components, renderers] = await Promise.all([
        import("echarts/core"),
        import("echarts/charts"),
        import("echarts/components"),
        import("echarts/renderers"),
      ]);
      if (cancelled) return;
      core.use([charts.BarChart, components.GridComponent, components.TooltipComponent, renderers.CanvasRenderer]);
      const chart = core.init(element);
      chartRef.current = chart;
      chart.setOption(buildRef.current(themeColors(element)));
      observer = new ResizeObserver(() => chart.resize());
      observer.observe(element);
    })();

    window.addEventListener("indoquake:theme", repaint);
    media.addEventListener("change", repaint);
    return () => {
      cancelled = true;
      observer?.disconnect();
      window.removeEventListener("indoquake:theme", repaint);
      media.removeEventListener("change", repaint);
      chartRef.current?.dispose();
      chartRef.current = null;
    };
  }, []);

  return <div ref={containerRef} role="img" aria-label={label} style={{ height }} className="w-full" />;
}
