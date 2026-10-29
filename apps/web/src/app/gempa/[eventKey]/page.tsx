import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BMKG_ATTRIBUTION, SAFETY_DISCLAIMER } from "@indoquake/shared";
import { parseMmiString } from "@indoquake/earthquake";
import { UNKNOWN_AREA_LABEL } from "@indoquake/regions/meta";
import { MagBadge } from "@/components/mag-badge";
import { loadEarthquakeDetail } from "@/lib/detail";
import { formatMagnitude } from "@/lib/magnitude";
import { eventAreaLabel, formatEventTime } from "@/lib/event-time";

export const dynamic = "force-dynamic";

const FIELD_LABELS: Record<string, string> = {
  magnitude: "Magnitudo",
  depthKm: "Kedalaman",
  latitude: "Lintang",
  longitude: "Bujur",
  eventTimeUtc: "Waktu",
  regionName: "Wilayah",
  potentialText: "Status potensi",
  feltText: "Laporan dirasakan",
  shakemapUrl: "ShakeMap",
  tsunamiPotential: "Potensi tsunami",
};

type Params = { params: Promise<{ eventKey: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { eventKey } = await params;
  const event = await loadEarthquakeDetail(eventKey);
  if (!event) return { title: "Gempa tidak ditemukan" };
  const title = `M${formatMagnitude(event.magnitude)} ${event.regionName}`;
  return {
    title,
    description: `Gempa M${formatMagnitude(event.magnitude)} kedalaman ${event.depthKm} km, ${formatEventTime(event, "dateTime")}. Sumber data: BMKG.`,
    openGraph: { title },
  };
}

function Section({ title, tag, children }: { title: string; tag?: "Resmi BMKG" | "Estimasi"; children: React.ReactNode }) {
  return (
    <section className="border-t border-border py-6">
      <h2 className="flex items-center gap-3 text-base font-semibold text-foreground">
        {title}
        {tag && <span className="rounded-sm border border-border px-1.5 text-xs font-medium text-muted">{tag}</span>}
      </h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

export default async function EarthquakeDetailPage({ params }: Params) {
  const { eventKey } = await params;
  const event = await loadEarthquakeDetail(eventKey);
  if (!event) notFound();

  const feltReports = [...(event.feltReports ?? [])].sort(
    (a, b) => (parseMmiString(b.mmi)?.max ?? 0) - (parseMmiString(a.mmi)?.max ?? 0),
  );
  const facts = [
    { label: "Waktu", value: formatEventTime(event, "long") },
    { label: "Waktu UTC", value: `${event.eventTimeUtc.slice(0, 19).replace("T", " ")} UTC` },
    { label: "Kedalaman", value: `${event.depthKm} km` },
    { label: "Koordinat", value: `${event.latitude.toFixed(2)}, ${event.longitude.toFixed(2)}` },
    { label: "Wilayah", value: eventAreaLabel(event) ?? UNKNOWN_AREA_LABEL },
  ];
  const tsunamiText =
    event.tsunamiPotential === true
      ? "Berpotensi tsunami. Ikuti arahan resmi BMKG dan BPBD."
      : event.tsunamiPotential === false
        ? "Tidak berpotensi tsunami."
        : "Belum ada informasi potensi tsunami dari BMKG.";

  return (
    <article className="mx-auto w-full max-w-screen-md px-4 pb-12">
      <nav aria-label="Lokasi halaman" className="pt-6 text-sm">
        <Link href="/" className="inline-flex min-h-11 items-center text-muted underline underline-offset-4 hover:text-foreground">
          Beranda
        </Link>
      </nav>
      <header className="pt-2 pb-6">
        <MagBadge magnitude={event.magnitude} size="lg" />
        <h1 className="mt-3 text-2xl leading-snug font-semibold text-foreground sm:text-4xl">{event.regionName}</h1>
        <p className="num mt-2 text-sm text-muted">{formatEventTime(event, "dateTime")}</p>
      </header>

      <Section title="Parameter gempa" tag="Resmi BMKG">
        <dl className="num grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
          {facts.map((fact) => (
            <div key={fact.label} className="contents">
              <dt className="text-muted">{fact.label}</dt>
              <dd className="text-foreground">{fact.value}</dd>
            </div>
          ))}
        </dl>
      </Section>

      <Section title="Status tsunami" tag="Resmi BMKG">
        <p className={`text-base ${event.tsunamiPotential ? "font-semibold text-danger" : "text-foreground"}`}>{tsunamiText}</p>
        {event.potentialText && <p className="mt-1 text-sm text-muted">BMKG: {event.potentialText}</p>}
        <p className="mt-4 max-w-prose text-sm text-muted">{SAFETY_DISCLAIMER}</p>
      </Section>

      <Section title="Laporan dirasakan" tag="Resmi BMKG">
        {feltReports.length > 0 ? (
          <ul className="flex flex-wrap gap-2">
            {feltReports.map((report, index) => (
              <li key={`${report.mmi}-${report.place}-${index}`} className="rounded-sm border border-border px-2 py-1 text-sm text-foreground">
                <span className="num">MMI {report.mmi}</span> {report.place}
              </li>
            ))}
          </ul>
        ) : event.feltText ? (
          <p className="text-sm text-foreground">{event.feltText}</p>
        ) : (
          <p className="text-sm text-muted">Belum ada laporan dirasakan untuk gempa ini.</p>
        )}
      </Section>

      {event.shakemapUrl && (
        <Section title="ShakeMap" tag="Resmi BMKG">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={event.shakemapUrl}
            alt={`ShakeMap BMKG untuk gempa M${formatMagnitude(event.magnitude)} ${event.regionName}`}
            width={800}
            height={800}
            loading="lazy"
            decoding="async"
            className="aspect-square h-auto w-full rounded-sm border border-border bg-surface-2 object-contain"
          />
          <a href={event.shakemapUrl} rel="noreferrer" className="mt-2 inline-flex min-h-11 items-center text-sm text-muted underline underline-offset-4 hover:text-foreground">
            Buka gambar asli
          </a>
        </Section>
      )}

      {event.revisions.length > 0 && (
        <Section title="Riwayat perubahan parameter">
          <div className="overflow-x-auto">
            <table className="num w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted">
                  <th scope="col" className="py-1 pr-4 font-medium">Parameter</th>
                  <th scope="col" className="py-1 pr-4 font-medium">Sebelumnya</th>
                  <th scope="col" className="py-1 pr-4 font-medium">Menjadi</th>
                  <th scope="col" className="py-1 font-medium">Diamati</th>
                </tr>
              </thead>
              <tbody>
                {event.revisions.map((revision, index) => (
                  <tr key={`${revision.field}-${revision.observedAt}-${index}`} className="border-t border-border">
                    <td className="py-2 pr-4">{FIELD_LABELS[revision.field] ?? revision.field}</td>
                    <td className="py-2 pr-4">{revision.oldValue ?? "kosong"}</td>
                    <td className="py-2 pr-4">{revision.newValue ?? "kosong"}</td>
                    <td className="py-2">{formatEventTime(event, "dateTime", revision.observedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}

      <Section title="Sumber">
        <ul className="space-y-1 text-sm text-muted">
          <li>{BMKG_ATTRIBUTION}</li>
          <li>Feed: {event.feeds.length > 0 ? event.feeds.join(", ") : "tidak tercatat"}</li>
          <li className="num">Kode kejadian: {event.eventKey}</li>
          {event.lastUpdatedAt && <li>Terakhir diperbarui: {formatEventTime(event, "dateTime", event.lastUpdatedAt)}</li>}
        </ul>
      </Section>
    </article>
  );
}
