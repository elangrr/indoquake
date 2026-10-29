import type { Metadata } from "next";
import { PageHeading } from "@/components/page-heading";
import { StatsView } from "@/components/stats-view";

// Rendered per request so the client view, which reads the URL with useSearchParams, is in the
// server HTML (form, list skeleton) instead of a client-only Suspense fallback; see the no-JS e2e.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Statistik gempa",
  description: "Jumlah, magnitudo, kedalaman dan sebaran provinsi gempa Indonesia per periode, dari data BMKG.",
};

export default function StatistikPage() {
  return (
    <div className="mx-auto w-full max-w-screen-xl">
      <PageHeading title="Statistik gempa" />
      <StatsView />
    </div>
  );
}
