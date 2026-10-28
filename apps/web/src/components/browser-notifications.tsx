"use client";

import { useState, useSyncExternalStore } from "react";
import {
  getNotificationPermission,
  getNotifySettingsServerSnapshot,
  getNotifySettingsSnapshot,
  subscribeNotifySettings,
  writeNotifySettings,
} from "@/lib/notify-settings";
import { useIsClient } from "@/lib/use-is-client";

const inputClass =
  "mt-1 block min-h-11 w-full rounded-sm border border-border bg-surface px-3 text-base text-foreground";

export function BrowserNotifications() {
  const isClient = useIsClient();
  const settings = useSyncExternalStore(
    subscribeNotifySettings,
    getNotifySettingsSnapshot,
    getNotifySettingsServerSnapshot,
  );
  const [message, setMessage] = useState<string | null>(null);

  const supported =
    isClient && typeof window !== "undefined" && "Notification" in window;
  const permission = isClient ? getNotificationPermission() : "unsupported";

  const refreshPermission = () => {
    writeNotifySettings({ ...settings });
  };

  const enable = async () => {
    if (!supported) {
      setMessage("Browser ini tidak mendukung notifikasi.");
      return;
    }
    const result = await window.Notification.requestPermission();
    refreshPermission();
    if (result === "granted") {
      writeNotifySettings({ ...settings, enabled: true });
      setMessage("Notifikasi browser aktif.");
    } else {
      setMessage(
        "Izin tidak diberikan. Izinkan notifikasi lewat ikon gembok di address bar.",
      );
    }
  };

  const update = (patch: Partial<typeof settings>) => {
    writeNotifySettings({ ...settings, ...patch });
  };

  const sendBrowserTest = async () => {
    if (!supported) {
      setMessage("Browser ini tidak mendukung notifikasi.");
      return;
    }
    let current = window.Notification.permission;
    if (current === "default") {
      current = await window.Notification.requestPermission();
      refreshPermission();
    }
    if (current !== "granted") {
      setMessage(
        current === "denied"
          ? "Izin notifikasi ditolak. Izinkan notifikasi lewat ikon gembok di address bar, lalu coba lagi."
          : "Izin notifikasi belum diberikan.",
      );
      return;
    }
    try {
      new window.Notification("Uji notifikasi Indoquake", {
        body: "Ini pesan uji, bukan gempa nyata. Kalau pesan ini muncul, notifikasi browser berfungsi.",
      });
      setMessage(
        "Perintah kirim dijalankan. Kalau tidak ada yang muncul, cek pengaturan notifikasi sistem (Windows: Mode Jangan Ganggu / Focus Assist) atau daftar situs diblokir.",
      );
    } catch (error) {
      setMessage(
        `Gagal menampilkan: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  };

  return (
    <section aria-labelledby="notifikasi-browser" className="border-t border-border px-4 py-6">
      <div className="flex items-center justify-between gap-3">
        <h2 id="notifikasi-browser" className="text-base font-semibold text-foreground">
          Notifikasi browser
        </h2>
        <span className="text-xs text-muted">
          {!supported
            ? "tidak didukung"
            : permission === "granted"
              ? "izin diberikan"
              : permission === "denied"
                ? "izin ditolak"
                : "izin belum diminta"}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {settings.enabled ? (
          <button
            type="button"
            onClick={() => {
              update({ enabled: false });
              setMessage("Notifikasi browser dimatikan.");
            }}
            className="min-h-11 rounded-sm border border-danger px-4 text-sm text-danger transition-colors duration-150 hover:bg-danger-soft"
          >
            Matikan notifikasi
          </button>
        ) : (
          <button
            type="button"
            onClick={() => void enable()}
            className="inline-flex min-h-11 items-center rounded-sm bg-foreground px-4 text-sm font-medium text-background transition-colors duration-150 hover:bg-signal"
          >
            Aktifkan notifikasi
          </button>
        )}
        <button
          type="button"
          onClick={() => void sendBrowserTest()}
          className="min-h-11 rounded-sm border border-border px-4 text-sm text-foreground transition-colors duration-150 hover:border-foreground"
        >
          Kirim notifikasi uji
        </button>
        {message && (
          <span className="text-xs text-muted">{message}</span>
        )}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <label className="text-xs text-muted">
          Magnitudo minimum
          <input
            type="number"
            step="0.1"
            min={0}
            max={10}
            value={settings.minMagnitude}
            onChange={(event) =>
              update({ minMagnitude: Number(event.target.value) })
            }
            className={inputClass}
          />
        </label>
        <label className="text-xs text-muted">
          Radius maksimum (km)
          <input
            type="number"
            min={1}
            max={2000}
            placeholder="semua"
            value={settings.maxDistanceKm ?? ""}
            onChange={(event) =>
              update({
                maxDistanceKm:
                  event.target.value === "" ? null : Number(event.target.value),
              })
            }
            className={inputClass}
          />
        </label>
        <label className="mt-5 flex items-center gap-1.5 text-xs text-muted">
          <input
            type="checkbox"
            checked={settings.tsunamiOnly}
            onChange={(event) => update({ tsunamiOnly: event.target.checked })}
            className="h-5 w-5 accent-[var(--signal)]"
          />
          Hanya potensi tsunami
        </label>
        <label className="mt-5 flex items-center gap-1.5 text-xs text-muted">
          <input
            type="checkbox"
            checked={settings.feltOnly}
            onChange={(event) => update({ feltOnly: event.target.checked })}
            className="h-5 w-5 accent-[var(--signal)]"
          />
          Hanya dirasakan
        </label>
      </div>

      {settings.maxDistanceKm !== null && (
        <p className="mt-2 text-xs text-muted">
          Filter radius memakai lokasi Anda (aktifkan di beranda). Tanpa lokasi,
          notifikasi dengan filter radius tidak akan tampil.
        </p>
      )}

      <p className="mt-2 text-xs text-muted">
        Pengaturan disimpan di browser Anda (localStorage), tidak dikirim ke
        server.
      </p>
    </section>
  );
}
