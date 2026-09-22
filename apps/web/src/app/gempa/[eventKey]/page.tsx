import Link from "next/link";
import { notFound } from "next/navigation";
import { BMKG_ATTRIBUTION } from "@indoquake/shared";
import { parseMmiString } from "@indoquake/earthquake";
import { getEarthquakeDetail } from "@/lib/queries";
import { formatMagnitude, magnitudeColor } from "@/lib/magnitude";

export const dynamic = "force-dynamic";

const FIELD_LABELS: Record<string, string> = {
  magnitude: "Magnitudo",
  depthKm: "Kedalaman",
  latitude: "Lintang",
  longitude: "Bujur",
  regionName: "Wilayah",
  potentialText: "Status potensi",
  feltText: "Laporan dirasakan",
  shakemapUrl: "ShakeMap",
  tsunamiPotential: "Potensi tsunami",
};

function formatUtc(iso: string): string {
  return `${iso.slice(0, 19).replace("T", " ")} UTC`;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ eventKey: string }>;
}) {
  const { eventKey } = await params;
  const event = await getEarthquakeDetail(eventKey);
  if (!event) return { title: "Gempa tidak ditemukan — Indoquake" };
  return {
    title: `M${formatMagnitude(event.magnitude)} ${event.regionName} — Indoquake`,
    description: `Gempa M${formatMagnitude(event.magnitude)} kedalaman ${event.depthKm} km, ${event.eventTimeWib}. Data resmi BMKG.`,
  };
}

export default async function EarthquakeDetailPage({
  params,
}: {
  params: Promise<{ eventKey: string }>;
}) {
  const { eventKey } = await params;
  const event = await getEarthquakeDetail(eventKey);
  if (!event) notFound();

  const feltReports = [...(event.feltReports ?? [])].sort((a, b) => {
    const aMax = parseMmiString(a.mmi)?.max ?? 0;
    const bMax = parseMmiString(b.mmi)?.max ?? 0;
    return bMax - aMax;
  });

  const stats = [
    { label: "Kedalaman", value: `${event.depthKm} km` },
    { label: "Waktu (WIB)", value: event.eventTimeWib },
    { label: "Waktu (UTC)", value: formatUtc(event.eventTimeUtc) },
    {
      label: "Koordinat",
      value: `${event.latitude.toFixed(2)}, ${event.longitude.toFixed(2)}`,
    },
    { label: "Wilayah", value: event.regionName },
  ];

  return (
    <div className="mx-auto min-h-0 w-full max-w-3xl flex-1 overflow-y-auto px-4 py-6">
      <Link href="/" className="text-xs text-accent hover:underline">
        ← Kembali ke peta
      </Link>

      <header className="mt-4 flex items-start gap-4">
        <span
          className="rounded-lg px-3 py-2 text-2xl font-bold text-[#0b0f14]"
          style={{ backgroundColor: magnitudeColor(event.magnitude) }}
        >
          M{formatMagnitude(event.magnitude)}
        </span>
        <div>
          <h1 className="text-lg font-semibold text-foreground">
            {event.regionName}
          </h1>
          <p className="mt-1 text-xs text-muted">
            Parameter gempa dari BMKG · {event.eventTimeWib}
          </p>
        </div>
      </header>

      <section className="mt-6 rounded-lg border border-border bg-surface">
        <h2 className="border-b border-border px-4 py-2 text-xs font-semibold tracking-wide text-foreground">
          DATA RESMI BMKG
        </h2>
        <dl className="grid grid-cols-1 gap-px sm:grid-cols-2">
          {stats.map((stat) => (
            <div key={stat.label} className="px-4 py-3">
              <dt className="text-[11px] uppercase tracking-wide text-muted">
                {stat.label}
              </dt>
              <dd className="mt-0.5 text-sm text-foreground">{stat.value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="mt-4 rounded-lg border border-border bg-surface px-4 py-3">
        <h2 className="text-xs font-semibold tracking-wide text-foreground">
          STATUS TSUNAMI (RESMI BMKG)
        </h2>
        <p className="mt-1 text-sm text-foreground">
          {event.tsunamiPotential === true
            ? "Berpotensi tsunami — ikuti arahan resmi BMKG/BPBD."
            : event.tsunamiPotential === false
              ? "Tidak berpotensi tsunami."
              : "Tidak ada informasi potensi tsunami pada feed ini."}
        </p>
        {event.potentialText && (
          <p className="mt-1 text-xs text-muted">
            Catatan feed: {event.potentialText}
          </p>
        )}
      </section>

      <section className="mt-4 rounded-lg border border-border bg-surface px-4 py-3">
        <h2 className="text-xs font-semibold tracking-wide text-foreground">
          LAPORAN DIRASAKAN (RESMI BMKG)
        </h2>
        {feltReports.length > 0 ? (
          <>
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {feltReports.map((report, index) => (
                <li
                  key={`${report.mmi}-${report.place}-${index}`}
                  className="rounded-full border border-border px-2 py-0.5 text-[11px] text-foreground"
                >
                  MMI {report.mmi} · {report.place}
                </li>
              ))}
            </ul>
            {event.feltText && (
              <p className="mt-2 text-[11px] text-muted">
                Teks asli BMKG: {event.feltText}
              </p>
            )}
          </>
        ) : (
          <p className="mt-1 text-sm text-muted">
            Belum ada laporan dirasakan untuk kejadian ini.
          </p>
        )}
      </section>

      {event.shakemapUrl && (
        <section className="mt-4 rounded-lg border border-border bg-surface px-4 py-3">
          <h2 className="text-xs font-semibold tracking-wide text-foreground">
            SHAKEMAP (BMKG)
          </h2>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={event.shakemapUrl}
            alt={`ShakeMap BMKG untuk gempa ${event.regionName}`}
            className="mt-2 w-full rounded border border-border"
          />
          <a
            href={event.shakemapUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-1 inline-block text-[11px] text-accent hover:underline"
          >
            Buka gambar asli →
          </a>
        </section>
      )}

      {event.revisions.length > 0 && (
        <section className="mt-4 rounded-lg border border-border bg-surface px-4 py-3">
          <h2 className="text-xs font-semibold tracking-wide text-foreground">
            RIWAYAT PERUBAHAN PARAMETER
          </h2>
          <p className="mt-1 text-[11px] text-muted">
            Parameter otomatis BMKG dapat berubah sampai ditinjau seismolog.
          </p>
          <ul className="mt-2 space-y-1.5">
            {event.revisions.map((revision, index) => (
              <li
                key={`${revision.field}-${revision.observedAt}-${index}`}
                className="text-xs text-muted"
              >
                <span className="text-foreground">
                  {FIELD_LABELS[revision.field] ?? revision.field}
                </span>
                : {revision.oldValue ?? "—"} → {revision.newValue ?? "—"}{" "}
                <span className="text-[10px]">
                  ({formatUtc(revision.observedAt)})
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-4 rounded-lg border border-border bg-surface px-4 py-3">
        <h2 className="text-xs font-semibold tracking-wide text-foreground">
          SUMBER &amp; METADATA
        </h2>
        <ul className="mt-1 space-y-1 text-xs text-muted">
          <li>
            Sumber: <span className="text-foreground">{event.source}</span> ·{" "}
            {BMKG_ATTRIBUTION}
          </li>
          <li>Feed: {event.feeds.length > 0 ? event.feeds.join(", ") : "—"}</li>
          <li>Event key: {event.eventKey}</li>
          <li>
            Terakhir diperbarui:{" "}
            {event.lastUpdatedAt ? formatUtc(event.lastUpdatedAt) : "—"}
          </li>
        </ul>
      </section>

      <p className="mt-6 text-[11px] text-muted">
        Semua nilai pada halaman ini adalah data resmi BMKG. Estimasi aplikasi
        (jarak, perkiraan waktu tiba, perkiraan intensitas) tersedia di beranda
        setelah lokasi Anda diaktifkan, dan selalu ditandai ESTIMASI.
      </p>
    </div>
  );
}
