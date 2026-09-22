"use client";

import { useEffect, useRef } from "react";
import type { ECharts, EChartsCoreOption } from "echarts/core";

interface ChartProps {
  option: EChartsCoreOption;
  height?: number;
}

export function Chart({ option, height = 220 }: ChartProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<ECharts | null>(null);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    let cancelled = false;
    let observer: ResizeObserver | null = null;

    void (async () => {
      const [core, charts, components, renderers] = await Promise.all([
        import("echarts/core"),
        import("echarts/charts"),
        import("echarts/components"),
        import("echarts/renderers"),
      ]);
      if (cancelled) return;

      core.use([
        charts.BarChart,
        charts.LineChart,
        charts.ScatterChart,
        components.GridComponent,
        components.TooltipComponent,
        components.LegendComponent,
        renderers.CanvasRenderer,
      ]);

      const chart = core.init(element);
      chartRef.current = chart;
      chart.setOption(option);
      observer = new ResizeObserver(() => chart.resize());
      observer.observe(element);
    })();

    return () => {
      cancelled = true;
      observer?.disconnect();
      chartRef.current?.dispose();
      chartRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    chartRef.current?.setOption(option);
  }, [option]);

  return <div ref={containerRef} style={{ height }} className="w-full" />;
}
