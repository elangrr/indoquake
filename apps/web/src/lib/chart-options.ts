import type { EChartsCoreOption } from "echarts/core";

const AXIS_COLOR = "#8aa0b6";
const SPLIT_COLOR = "#1f2b3a";
const TOOLTIP_BG = "#16202c";

const BASE = {
  backgroundColor: "transparent",
  grid: { left: 40, right: 16, top: 24, bottom: 28 },
  tooltip: {
    trigger: "axis",
    backgroundColor: TOOLTIP_BG,
    borderColor: SPLIT_COLOR,
    textStyle: { color: "#e5edf5", fontSize: 11 },
  },
};

function axis(labelRotate = 0) {
  return {
    type: "category" as const,
    axisLabel: { color: AXIS_COLOR, fontSize: 10, rotate: labelRotate },
    axisLine: { lineStyle: { color: SPLIT_COLOR } },
    axisTick: { show: false },
  };
}

function valueAxis() {
  return {
    type: "value" as const,
    axisLabel: { color: AXIS_COLOR, fontSize: 10 },
    splitLine: { lineStyle: { color: SPLIT_COLOR } },
  };
}

export function barChartOption(
  labels: string[],
  values: number[],
  color: string,
  labelRotate = 0,
): EChartsCoreOption {
  return {
    ...BASE,
    xAxis: { ...axis(labelRotate), data: labels },
    yAxis: valueAxis(),
    series: [
      {
        type: "bar" as const,
        data: values,
        itemStyle: { color, borderRadius: [3, 3, 0, 0] },
        barMaxWidth: 36,
      },
    ],
  };
}

export function horizontalBarChartOption(
  labels: string[],
  values: number[],
  color: string,
): EChartsCoreOption {
  return {
    ...BASE,
    grid: { left: 96, right: 24, top: 12, bottom: 24 },
    xAxis: valueAxis(),
    yAxis: { ...axis(), data: labels, inverse: true },
    series: [
      {
        type: "bar" as const,
        data: values,
        itemStyle: { color, borderRadius: [0, 3, 3, 0] },
        barMaxWidth: 18,
      },
    ],
  };
}

export function lineChartOption(
  labels: string[],
  values: number[],
  color: string,
): EChartsCoreOption {
  return {
    ...BASE,
    xAxis: { ...axis(45), data: labels },
    yAxis: valueAxis(),
    series: [
      {
        type: "line" as const,
        data: values,
        smooth: true,
        symbolSize: 5,
        itemStyle: { color },
        lineStyle: { color, width: 2 },
        areaStyle: { color: "rgba(56, 189, 248, 0.12)" },
      },
    ],
  };
}

export function scatterChartOption(
  points: [number, number][],
  color: string,
): EChartsCoreOption {
  return {
    ...BASE,
    tooltip: {
      ...BASE.tooltip,
      trigger: "item",
    },
    xAxis: {
      ...valueAxis(),
      name: "Magnitudo",
      nameTextStyle: { color: AXIS_COLOR, fontSize: 10 },
    },
    yAxis: {
      ...valueAxis(),
      name: "Kedalaman (km)",
      nameTextStyle: { color: AXIS_COLOR, fontSize: 10 },
      inverse: true,
    },
    series: [
      {
        type: "scatter" as const,
        name: "[magnitudo, kedalaman km]",
        data: points,
        symbolSize: 7,
        itemStyle: { color, opacity: 0.75 },
      },
    ],
  };
}
