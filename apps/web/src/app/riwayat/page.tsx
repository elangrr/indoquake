import type { Metadata } from "next";
import { Suspense } from "react";
import { PROVINCE_OPTIONS } from "@indoquake/regions";
import { HistoryView } from "@/components/history-view";
import { EventListSkeleton } from "@/components/event-list";
import { PageHeading } from "@/components/page-heading";

export const metadata: Metadata = {
  title: "Riwayat gempa",
  description: "Semua gempa Pulau Jawa yang tercatat dari BMKG, dengan saringan magnitudo, kedalaman, tanggal dan provinsi.",
};

export default function RiwayatPage() {
  return (
    <div className="mx-auto w-full max-w-screen-xl">
      <PageHeading title="Riwayat gempa" />
      <Suspense fallback={<EventListSkeleton />}>
        <HistoryView provinces={PROVINCE_OPTIONS} />
      </Suspense>
    </div>
  );
}
