import { classifyTsunamiPotential } from "@indoquake/bmkg";

export interface EarthquakeSnapshot {
  eventTimeUtc: string;
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

/**
 * numeric / time: newest value wins (BMKG revises origin parameters) and logs a revision.
 * sticky: first writer wins (feeds word the region differently).
 * classified: potentialText is replaced whenever the incoming text states a tsunami potential
 *   (true or false), so the text can never contradict the flag (D03); otherwise sticky.
 * overwrite: any non-null incoming value wins (lets BMKG retract a tsunami flag).
 */
type FieldPolicy = "numeric" | "time" | "overwrite" | "sticky" | "classified";

const FIELD_POLICIES: Record<keyof EarthquakeSnapshot, FieldPolicy> = {
  eventTimeUtc: "time",
  magnitude: "numeric",
  depthKm: "numeric",
  latitude: "numeric",
  longitude: "numeric",
  regionName: "sticky",
  potentialText: "classified",
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

function isEmpty(value: unknown): boolean {
  return value === null || value === "";
}

export function diffSnapshots(
  existing: EarthquakeSnapshot,
  incoming: EarthquakeSnapshot,
): DiffResult {
  const changes: FieldChange[] = [];
  const updates: Partial<EarthquakeSnapshot> = {};
  const record = (field: keyof EarthquakeSnapshot, oldValue: string | null, newValue: string | null) => {
    changes.push({ field, oldValue, newValue });
    Object.assign(updates, { [field]: incoming[field] });
  };

  for (const field of Object.keys(FIELD_POLICIES) as (keyof EarthquakeSnapshot)[]) {
    const policy = FIELD_POLICIES[field];
    const oldValue = existing[field];
    const newValue = incoming[field];

    if (policy === "time") {
      const oldIso = new Date(oldValue as string).toISOString();
      const newIso = new Date(newValue as string).toISOString();
      if (oldIso !== newIso) record(field, oldIso, newIso);
      continue;
    }
    if (policy === "numeric") {
      if (Math.abs((oldValue as number) - (newValue as number)) > NUMERIC_EPSILON) {
        record(field, formatValue(oldValue), formatValue(newValue));
      }
      continue;
    }
    if (newValue === null || oldValue === newValue) continue;
    if (policy === "sticky" && !isEmpty(oldValue)) continue;
    if (
      policy === "classified" &&
      !isEmpty(oldValue) &&
      classifyTsunamiPotential(newValue as string) === null
    ) {
      continue;
    }
    record(field, formatValue(oldValue), formatValue(newValue));
  }

  return { changes, updates };
}
