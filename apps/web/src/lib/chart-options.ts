import type { EChartsCoreOption } from "echarts/core";

export interface ChartColors {
  ink: string;
  muted: string;
  rule: string;
  signal: string;
  surface: string;
}

const FONT = "Martian Mono, ui-monospace, monospace";

function axisText(colors: ChartColors) {
  return { color: colors.muted, fontFamily: FONT, fontSize: 12 };
}

function tooltip(colors: ChartColors) {
  return {
    trigger: "axis",
    backgroundColor: colors.surface,
    borderColor: colors.rule,
    textStyle: { color: colors.ink, fontFamily: FONT, fontSize: 12 },
  };
}

/** Vertical bars: one series, signal colour on the largest bar only, the rest in ink. */
export function columnOption(labels: string[], values: number[], colors: ChartColors): EChartsCoreOption {
  const max = Math.max(0, ...values);
  return {
    animation: false,
    grid: { left: 8, right: 8, top: 16, bottom: 8, containLabel: true },
    tooltip: tooltip(colors),
    xAxis: {
      type: "category",
      data: labels,
      axisLine: { lineStyle: { color: colors.rule } },
      axisTick: { show: false },
      axisLabel: axisText(colors),
    },
    yAxis: {
      type: "value",
      minInterval: 1,
      splitLine: { lineStyle: { color: colors.rule, type: "dashed" } },
      axisLabel: axisText(colors),
    },
    series: [
      {
        type: "bar",
        barMaxWidth: 24,
        data: values.map((value) => ({
          value,
          itemStyle: { color: value === max && max > 0 ? colors.signal : colors.ink, opacity: value === max ? 1 : 0.7 },
        })),
      },
    ],
  };
}

/** Horizontal bars for distributions and provinces. */
export function rowOption(labels: string[], values: number[], colors: ChartColors): EChartsCoreOption {
  return {
    animation: false,
    grid: { left: 8, right: 24, top: 8, bottom: 8, containLabel: true },
    tooltip: { ...tooltip(colors), axisPointer: { type: "shadow" } },
    xAxis: {
      type: "value",
      minInterval: 1,
      splitLine: { lineStyle: { color: colors.rule, type: "dashed" } },
      axisLabel: axisText(colors),
    },
    yAxis: {
      type: "category",
      data: labels,
      inverse: true,
      axisLine: { lineStyle: { color: colors.rule } },
      axisTick: { show: false },
      axisLabel: { ...axisText(colors), color: colors.ink },
    },
    series: [{ type: "bar", barMaxWidth: 18, data: values, itemStyle: { color: colors.ink, opacity: 0.8 } }],
  };
}

/** API bucket labels use typographic dashes (U+2013) and U+2265; the UI writes them in words. */
export function bucketLabel(label: string): string {
  return label
    .replace(/\s*[\u2013\u2014]\s*/g, " sampai ")
    .replace(/^\u2265\s*(.+)$/, "$1 ke atas")
    .replace(/^<\s*(.+)$/, "di bawah $1");
}
