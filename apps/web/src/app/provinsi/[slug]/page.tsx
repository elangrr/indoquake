import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PROVINCE_OPTIONS, provinceBySlug } from "@indoquake/regions";
import { EventListSkeleton } from "@/components/event-list";
import { PageHeading } from "@/components/page-heading";
import { ProvinceEvents } from "@/components/province-events";

export function generateStaticParams() {
  return PROVINCE_OPTIONS.map((province) => ({ slug: province.slug }));
}

export const dynamicParams = false;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const province = provinceBySlug(slug);
  if (!province) return { title: "Provinsi tidak ditemukan" };
  return {
    title: `Gempa ${province.name}`,
    description: `Gempa bumi yang tercatat di ${province.name} dari data BMKG.`,
  };
}

export default async function ProvincePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const province = provinceBySlug(slug);
  if (!province) notFound();

  return (
    <div className="mx-auto w-full max-w-screen-xl">
      <nav aria-label="Lokasi halaman" className="px-4 pt-6 text-sm">
        <Link href="/provinsi" className="inline-flex min-h-11 items-center text-muted underline underline-offset-4 hover:text-foreground">
          Provinsi
        </Link>
      </nav>
      <PageHeading title={`Gempa ${province.name}`} />
      <Suspense fallback={<EventListSkeleton />}>
        <ProvinceEvents slug={slug} />
      </Suspense>
    </div>
  );
}
