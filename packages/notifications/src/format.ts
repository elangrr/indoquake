import type { AlertEvent } from "./matching";

export interface AlertMessageOptions {
  distanceKm?: number | null;
}

export function formatAlertMessage(
  event: AlertEvent,
  options: AlertMessageOptions = {},
): string {
  const lines: string[] = [
    "🌏 Indoquake — gempa baru (data BMKG)",
    "",
    `M${event.magnitude.toFixed(1)} · ${event.regionName}`,
    `Kedalaman ${event.depthKm} km · ${event.eventTimeWib}`,
  ];

  if (options.distanceKm !== undefined && options.distanceKm !== null) {
    lines.push(
      `Jarak ≈ ${Math.round(options.distanceKm)} km dari lokasi langganan (estimasi)`,
    );
  }

  if (event.tsunamiPotential === true) {
    lines.push(
      "",
      "⚠️ BMKG: BERPOTENSI TSUNAMI — ikuti arahan resmi BMKG/BPBD.",
    );
  }

  if (event.feltText) {
    lines.push(`Dirasakan (BMKG): ${event.feltText}`);
  }

  lines.push(
    "",
    "Sumber data: BMKG. Ini notifikasi aplikasi, bukan peringatan resmi.",
  );

  return lines.join("\n");
}

export function formatStartMessage(): string {
  return [
    "🌏 Indoquake — bot gempa & tsunami Jawa",
    "",
    "Perintah:",
    "/terbaru — gempa terakhir",
    "/hariini — gempa hari ini",
    "/kuat — gempa M5+ terakhir",
    "/tsunami — gempa berpotensi tsunami",
    "",
    "Data resmi BMKG. Notifikasi aplikasi, bukan peringatan resmi.",
  ].join("\n");
}

export function formatTestMessage(): string {
  return [
    "🔔 Uji notifikasi Indoquake",
    "",
    "Ini pesan UJI — bukan gempa nyata.",
    "Kalau pesan ini sampai, kanal notifikasi berfungsi.",
    "",
    "Sumber data gempa: BMKG. Notifikasi aplikasi, bukan peringatan resmi.",
  ].join("\n");
}
