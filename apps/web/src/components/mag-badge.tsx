import { formatMagnitude, magnitudeColor } from "@/lib/magnitude";

const SIZES = {
  sm: "text-sm gap-1.5",
  md: "text-base gap-2",
  lg: "text-4xl gap-3",
} as const;

/** Magnitude as a figure with a colour tick; the number carries the meaning, the colour repeats it. */
export function MagBadge({ magnitude, size = "sm" }: { magnitude: number; size?: keyof typeof SIZES }) {
  return (
    <span className={`num inline-flex items-center font-semibold text-foreground ${SIZES[size]}`}>
      <span
        aria-hidden="true"
        className={size === "lg" ? "h-8 w-1.5" : "h-3.5 w-1"}
        style={{ backgroundColor: magnitudeColor(magnitude) }}
      />
      M{formatMagnitude(magnitude)}
    </span>
  );
}
