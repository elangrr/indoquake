import type { Metadata } from "next";
import { PROVINCE_OPTIONS } from "@indoquake/regions/meta";
import { HistoryView } from "@/components/history-view";
import { PageHeading } from "@/components/page-heading";

// Rendered per request so the client view, which reads the URL with useSearchParams, is in the
// server HTML (form, list skeleton) instead of a client-only Suspense fallback; see the no-JS e2e.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Riwayat gempa",
  description: "Semua gempa Indonesia yang tercatat dari BMKG, dengan saringan magnitudo, kedalaman, tanggal dan provinsi.",
};

export default function RiwayatPage() {
  return (
    <div className="mx-auto w-full max-w-screen-xl">
      <PageHeading title="Riwayat gempa" />
      <HistoryView provinces={PROVINCE_OPTIONS} />
    </div>
  );
}
