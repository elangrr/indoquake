export function mmiColor(mmi: number): string {
  if (mmi >= 6) return "#ef4444";
  if (mmi >= 5) return "#f97316";
  if (mmi >= 4) return "#fbbf24";
  if (mmi >= 3) return "#a3e635";
  return "#38bdf8";
}
