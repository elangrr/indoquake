import { BMKG_ATTRIBUTION, SAFETY_DISCLAIMER } from "@indoquake/shared";

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-surface px-4 py-3 text-[11px] leading-relaxed text-muted">
      <p>{BMKG_ATTRIBUTION}</p>
      <p>{SAFETY_DISCLAIMER}</p>
    </footer>
  );
}
