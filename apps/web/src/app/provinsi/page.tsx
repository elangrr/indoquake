import Link from "next/link";
import { countByProvince } from "@indoquake/earthquake";
import { listEarthquakes } from "@/lib/queries";
import { PROVINCE_OPTIONS } from "@indoquake/regions";

export const dynamic = "force-dynamic";

export default async function ProvinsiIndexPage() {
  const events = await listEarthquakes({ limit: 5000 });
  const counts = countByProvince(events, PROVINCE_OPTIONS);
  const total = counts.reduce((sum, item) => sum + item.count, 0);

  return (
    <div className="mx-auto min-h-0 w-full max-w-4xl flex-1 overflow-y-auto px-4 py-6">
      <h1 className="text-lg font-semibold text-foreground">
        Dashboard Provinsi
      </h1>
      <p className="mt-1 text-xs text-muted">
        {total.toLocaleString("id-ID")} kejadian terpetakan ke provinsi dari
        data resmi BMKG yang tersimpan.
      </p>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {counts.map((item) => (
          <Link
            key={item.slug}
            href={`/provinsi/${item.slug}`}
            className="rounded-lg border border-border bg-surface px-4 py-3 transition-colors hover:border-accent"
          >
            <p className="text-sm font-semibold text-foreground">{item.name}</p>
            <p className="mt-1 text-2xl font-semibold text-accent">
              {item.count}
            </p>
            <p className="text-[11px] text-muted">kejadian tersimpan</p>
          </Link>
        ))}
      </div>

      <p className="mt-4 text-[10px] leading-relaxed text-muted">
        Provinsi ditentukan dari koordinat episenter (point-in-polygon). Gempa
        lepas pantai dipetakan ke provinsi terdekat dalam radius 250 km; di luar
        itu tidak dipetakan. Batas wilayah: geoBoundaries (CC BY 4.0).
      </p>
    </div>
  );
}
