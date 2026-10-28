import type { Metadata } from "next";
import { PROVINCE_OPTIONS } from "@indoquake/regions";
import { PageHeading } from "@/components/page-heading";
import { ProvinceList } from "@/components/province-list";

export const metadata: Metadata = {
  title: "Gempa per provinsi",
  description: "Jumlah gempa yang tercatat di setiap provinsi Pulau Jawa dari data BMKG.",
};

export default function ProvinsiPage() {
  return (
    <div className="mx-auto w-full max-w-screen-md">
      <PageHeading title="Gempa per provinsi" />
      <ProvinceList provinces={PROVINCE_OPTIONS} />
    </div>
  );
}
