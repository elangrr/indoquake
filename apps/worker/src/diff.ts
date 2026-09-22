export interface EarthquakeSnapshot {
  magnitude: number;
  depthKm: number;
  latitude: number;
  longitude: number;
  regionName: string;
  potentialText: string | null;
  feltText: string | null;
  shakemapUrl: string | null;
  tsunamiPotential: boolean | null;
}

export interface FieldChange {
  field: string;
  oldValue: string | null;
  newValue: string | null;
}

export interface DiffResult {
  changes: FieldChange[];
  updates: Partial<EarthquakeSnapshot>;
}

type FieldPolicy = "numeric" | "overwrite" | "sticky";

const FIELD_POLICIES: Record<keyof EarthquakeSnapshot, FieldPolicy> = {
  magnitude: "numeric",
  depthKm: "numeric",
  latitude: "numeric",
  longitude: "numeric",
  regionName: "sticky",
  potentialText: "sticky",
  feltText: "overwrite",
  shakemapUrl: "overwrite",
  tsunamiPotential: "overwrite",
};

const NUMERIC_EPSILON = 1e-4;

function formatValue(value: number | string | boolean | null): string | null {
  if (value === null) return null;
  if (typeof value === "number") return String(Number(value.toFixed(4)));
  return String(value);
}

export function diffSnapshots(
  existing: EarthquakeSnapshot,
  incoming: EarthquakeSnapshot,
): DiffResult {
  const changes: FieldChange[] = [];
  const updates: Partial<EarthquakeSnapshot> = {};

  for (const field of Object.keys(FIELD_POLICIES) as (keyof EarthquakeSnapshot)[]) {
    const policy = FIELD_POLICIES[field];
    if (policy === "numeric") {
      const oldValue = existing[field] as number;
      const newValue = incoming[field] as number;
      if (Math.abs(oldValue - newValue) > NUMERIC_EPSILON) {
        changes.push({
          field,
          oldValue: formatValue(oldValue),
          newValue: formatValue(newValue),
        });
        Object.assign(updates, { [field]: newValue });
      }
      continue;
    }

    const oldValue = existing[field];
    const newValue = incoming[field];
    if (newValue === null) continue;
    if (policy === "sticky" && oldValue !== null && oldValue !== "") continue;
    if (oldValue !== newValue) {
      changes.push({
        field,
        oldValue: formatValue(oldValue),
        newValue: formatValue(newValue),
      });
      Object.assign(updates, { [field]: newValue });
    }
  }

  return { changes, updates };
}
