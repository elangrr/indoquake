"use client";

import { useEffect, useState, type FormEvent } from "react";
import type { EarthquakeEvent } from "@indoquake/shared";
import type { DistanceInfo } from "@/lib/distances";
import type { GeocodeResult } from "@/lib/geocode";
import { PROVINCE_GROUPS, provinceBySlug } from "@indoquake/regions/meta";
import { PROVINCIAL_CAPITALS } from "@/lib/provincial-capitals";
import { MagBadge } from "./mag-badge";
import type { GeoStatus, UserLocation } from "@/lib/use-geolocation";

export const NEAR_RADII_KM = [25, 50, 100, 250, 500] as const;


interface LocationPanelProps {
  status: GeoStatus;
  location: UserLocation | null;
  error: string | null;
  nearest: { event: EarthquakeEvent; distance: DistanceInfo } | null;
  radiusKm: number;
  coastDistanceKm: number | null;
  onRadiusChange: (radiusKm: number) => void;
  onRequest: () => void;
  onClear: () => void;
  onSetManual: (latitude: number, longitude: number, label?: string) => void;
  onSelectEvent: (eventKey: string) => void;
}

function ManualLocationForm({
  onSetManual,
}: {
  onSetManual: (latitude: number, longitude: number, label?: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GeocodeResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 3) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setSearching(true);
      setSearchError(null);
      try {
        const response = await fetch(
          `/api/v1/geocode?q=${encodeURIComponent(trimmed)}`,
          { signal: controller.signal },
        );
        const json = (await response.json()) as {
          data?: GeocodeResult[];
          error?: string;
        };
        setResults(json.data ?? []);
        if (json.error) {
          setSearchError("Pencarian gagal. Coba lagi.");
        }
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          setSearchError("Pencarian gagal. Coba lagi.");
        }
      } finally {
        setSearching(false);
      }
    }, 600);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [query]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const lat = Number(latitude.replace(",", "."));
    const lon = Number(longitude.replace(",", "."));
    if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
      setFormError("Lintang harus berupa angka antara -90 dan 90.");
      return;
    }
    if (!Number.isFinite(lon) || lon < -180 || lon > 180) {
      setFormError("Bujur harus berupa angka antara -180 dan 180.");
      return;
    }
    setFormError(null);
    onSetManual(lat, lon, "Lokasi manual");
  };

  return (
    <div className="mt-2 space-y-2">
      <div>
        <label className="text-xs text-muted">
          Cari kecamatan / kelurahan / kota
          <input
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              if (event.target.value.trim().length < 3) {
                setResults([]);
                setSearchError(null);
              }
            }}
            placeholder="mis. Cibiru, Cipaganti, Sleman"
            className="mt-1 block min-h-11 w-full rounded-sm border border-border bg-surface px-3 text-base text-foreground"
          />
        </label>
        {searching && (
          <p className="mt-1 text-xs text-muted">Mencari…</p>
        )}
        {searchError && (
          <p className="mt-1 text-xs text-danger">{searchError}</p>
        )}
        {results.length > 0 && (
          <ul className="mt-1 max-h-40 overflow-y-auto rounded-sm border border-border">
            {results.map((result) => (
              <li
                key={`${result.name}-${result.latitude}-${result.longitude}`}
                className="border-b border-border last:border-b-0"
              >
                <button
                  type="button"
                  onClick={() => {
                    onSetManual(
                      result.latitude,
                      result.longitude,
                      result.name,
                    );
                    setResults([]);
                    setQuery("");
                  }}
                  className="min-h-11 w-full px-3 text-left hover:bg-surface-2"
                >
                  <span className="block text-xs text-foreground">
                    {result.name}
                  </span>
                  <span className="block text-xs text-muted">
                    {result.label}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-1 text-xs text-muted">
          &copy; OpenStreetMap contributors
        </p>
      </div>

      <p className="text-xs text-muted">Atau koordinat manual</p>

      <form onSubmit={submit} className="space-y-2">
        <div className="flex gap-2">
          <label className="flex-1 text-xs text-muted">
            Lintang
            <input
              value={latitude}
              onChange={(event) => setLatitude(event.target.value)}
              inputMode="decimal"
              placeholder="-6.9175"
              className="mt-1 block min-h-11 w-full rounded-sm border border-border bg-surface px-3 text-base text-foreground"
            />
          </label>
          <label className="flex-1 text-xs text-muted">
            Bujur
            <input
              value={longitude}
              onChange={(event) => setLongitude(event.target.value)}
              inputMode="decimal"
              placeholder="107.6191"
              className="mt-1 block min-h-11 w-full rounded-sm border border-border bg-surface px-3 text-base text-foreground"
            />
          </label>
        </div>
        {formError && <p className="text-xs text-danger">{formError}</p>}
        <button
          type="submit"
          className="min-h-11 rounded-sm border border-border px-4 text-sm text-foreground transition-colors duration-150 hover:border-foreground"
        >
          Terapkan koordinat
        </button>
      </form>

      <label className="block text-xs text-muted">
        Ibu kota provinsi
        <select
          value=""
          onChange={(event) => {
            const capital = PROVINCIAL_CAPITALS[event.target.value];
            if (capital) onSetManual(capital.latitude, capital.longitude, capital.name);
          }}
          className="mt-1 block min-h-11 w-full rounded-sm border border-border bg-surface px-3 text-base text-foreground"
        >
          <option value="" disabled>
            Pilih kota
          </option>
          {PROVINCE_GROUPS.map((group) => (
            <optgroup key={group.name} label={group.name}>
              {group.slugs.map((slug) => (
                <option key={slug} value={slug}>
                  {PROVINCIAL_CAPITALS[slug]?.name}, {provinceBySlug(slug)?.name}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </label>
    </div>
  );
}

export function LocationPanel({
  status,
  location,
  error,
  nearest,
  radiusKm,
  coastDistanceKm,
  onRadiusChange,
  onRequest,
  onClear,
  onSetManual,
  onSelectEvent,
}: LocationPanelProps) {
  const [showManual, setShowManual] = useState(false);

  return (
    <div className="border-b border-border px-4 py-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground">Lokasi saya</h2>
        {location && (
          <button
            type="button"
            onClick={onClear}
            className="inline-flex min-h-11 items-center text-sm text-muted underline underline-offset-4 hover:text-foreground"
          >
            Hapus lokasi
          </button>
        )}
      </div>

      {!location && status !== "requesting" && (
        <div className="mt-2">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onRequest}
              className="inline-flex min-h-11 items-center rounded-sm bg-foreground px-4 text-sm font-medium text-background transition-colors duration-150 hover:bg-signal"
            >
              Aktifkan Lokasi (GPS)
            </button>
            <button
              type="button"
              onClick={() => setShowManual((current) => !current)}
              className="min-h-11 rounded-sm border border-border px-4 text-sm text-muted transition-colors duration-150 hover:text-foreground"
            >
              {showManual ? "Tutup pencarian" : "Cari / Atur manual"}
            </button>
          </div>
          <p className="mt-2 text-xs leading-relaxed text-muted">
            Lokasi hanya dipakai di perangkat Anda untuk menghitung jarak &amp;
            estimasi. Tidak dikirim atau disimpan di server.
          </p>
          {(status === "denied" ||
            status === "unavailable" ||
            status === "error") && (
            <p className="mt-1.5 text-xs text-danger">
              {error ?? "Lokasi tidak tersedia."}
              {status === "denied" &&
                " Aktifkan izin lokasi di pengaturan browser, atau pakai pencarian manual."}
            </p>
          )}
          {showManual && <ManualLocationForm onSetManual={onSetManual} />}
        </div>
      )}

      {status === "requesting" && (
        <p className="mt-2 text-xs text-muted">Meminta izin lokasi…</p>
      )}

      {location && (
        <div className="mt-2 space-y-2">
          <div>
            <p className="text-xs text-muted">
              {location.label ? `${location.label} · ` : ""}
              {location.latitude.toFixed(4)}, {location.longitude.toFixed(4)}
              {location.source === "manual"
                ? " · input pengguna"
                : ` · akurasi ±${Math.round(location.accuracyM)} m`}
            </p>
            {coastDistanceKm !== null && (
              <p className="text-xs text-muted">
                Jarak ke pantai ≈{" "}
                <span className="text-foreground">{coastDistanceKm} km</span>{" "}
                (estimasi)
              </p>
            )}
            <button
              type="button"
              onClick={() => setShowManual((current) => !current)}
              className="mt-1 text-xs text-accent hover:underline"
            >
              {showManual ? "Tutup pencarian" : "Ubah lokasi (cari / manual)"}
            </button>
            {showManual && <ManualLocationForm onSetManual={onSetManual} />}
          </div>

          <div className="rounded-sm border border-border bg-surface-2 px-3 py-2">
            <p className="flex items-center gap-2 text-xs text-muted">
              Gempa terdekat
              <span className="rounded-sm border border-border px-1.5 text-xs font-medium text-muted">
                Estimasi
              </span>
            </p>
            {nearest ? (
              <>
                <button
                  type="button"
                  onClick={() => onSelectEvent(nearest.event.eventKey)}
                  className="mt-1 flex items-center gap-2 text-left"
                >
                  <MagBadge magnitude={nearest.event.magnitude} />
                  <span className="line-clamp-1 text-xs text-foreground hover:underline">
                    {nearest.event.regionName}
                  </span>
                </button>
                <p className="mt-1 text-xs text-muted">
                  Jarak episentral ≈{" "}
                  {Math.round(nearest.distance.epicentralKm)} km · hiposentral ≈{" "}
                  {Math.round(nearest.distance.hypocentralKm)} km
                </p>
                <p className="text-xs text-muted">
                  Dihitung dari posisi Anda (WGS84), nilai perkiraan.
                </p>
              </>
            ) : (
              <p className="mt-1 text-xs text-muted">
                Belum ada data gempa untuk dihitung.
              </p>
            )}
          </div>

          <div>
            <p className="text-xs text-muted">Radius “Di Sekitar Saya”</p>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {NEAR_RADII_KM.map((radius) => (
                <button
                  key={radius}
                  type="button"
                  onClick={() => onRadiusChange(radius)}
                  className={
                    radius === radiusKm
                      ? "min-h-11 rounded-sm border border-foreground bg-foreground px-4 text-sm text-background"
                      : "min-h-11 rounded-sm border border-border px-4 text-sm text-muted hover:text-foreground"
                  }
                >
                  {radius} km
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
