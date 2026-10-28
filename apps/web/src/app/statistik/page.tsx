import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeading } from "@/components/page-heading";
import { StatsSkeleton, StatsView } from "@/components/stats-view";

export const metadata: Metadata = {
  title: "Statistik gempa",
  description: "Jumlah, magnitudo, kedalaman dan sebaran provinsi gempa Pulau Jawa per periode, dari data BMKG.",
};

export default function StatistikPage() {
  return (
    <div className="mx-auto w-full max-w-screen-xl">
      <PageHeading title="Statistik gempa" />
      <Suspense fallback={<StatsSkeleton />}>
        <StatsView />
      </Suspense>
    </div>
  );
}
