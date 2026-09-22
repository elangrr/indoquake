export type PeriodId = "24h" | "7d" | "30d" | "1y" | "all";

export const PERIODS: readonly {
  id: PeriodId;
  label: string;
  days: number | null;
}[] = [
  { id: "24h", label: "24 jam", days: 1 },
  { id: "7d", label: "7 hari", days: 7 },
  { id: "30d", label: "30 hari", days: 30 },
  { id: "1y", label: "1 tahun", days: 365 },
  { id: "all", label: "Semua", days: null },
];

export interface ResolvedPeriod {
  id: PeriodId;
  label: string;
  fromUtc: string | null;
}

export function parsePeriod(value: string | undefined): ResolvedPeriod {
  const found = PERIODS.find((period) => period.id === value) ?? PERIODS[2];
  return {
    id: found.id,
    label: found.label,
    fromUtc:
      found.days === null
        ? null
        : new Date(Date.now() - found.days * 86_400_000).toISOString(),
  };
}
