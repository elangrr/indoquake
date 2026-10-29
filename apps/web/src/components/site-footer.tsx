import { BMKG_ATTRIBUTION, GEOBOUNDARIES_ATTRIBUTION, SAFETY_DISCLAIMER } from "@indoquake/shared";
import { BMKG_DATA_URL } from "@/lib/site";

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-surface">
      <div className="mx-auto max-w-screen-2xl space-y-1 px-4 py-4 text-xs text-muted">
        <p>
          <a href={BMKG_DATA_URL} rel="noreferrer" className="underline underline-offset-2 hover:text-foreground">
            {BMKG_ATTRIBUTION}
          </a>
        </p>
        <p data-testid="boundary-attribution">{GEOBOUNDARIES_ATTRIBUTION}</p>
        <p data-testid="safety-disclaimer" className="max-w-prose">
          {SAFETY_DISCLAIMER}
        </p>
      </div>
    </footer>
  );
}
