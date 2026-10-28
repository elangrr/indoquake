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
  "mt-1 w-full rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground outline-none focus:border-accent";

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
        "Izin tidak diberikan. Buka ikon gembok di address bar → Notifikasi → Izinkan.",
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
          ? "Izin notifikasi ditolak. Buka ikon gembok di address bar → Notifikasi → Izinkan, lalu coba lagi."
          : "Izin notifikasi belum diberikan.",
      );
      return;
    }
    try {
      new window.Notification("🔔 Uji notifikasi Indoquake", {
        body: "Ini pesan UJI — bukan gempa nyata. Kalau pesan ini muncul, notifikasi browser berfungsi.",
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
    <section className="rounded-lg border border-border bg-surface p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-foreground">
          Notifikasi Browser
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
      <p className="mt-1 text-xs leading-relaxed text-muted">
        Notifikasi tampil saat tab Indoquake terbuka. Ini notifikasi aplikasi
        (data BMKG), bukan peringatan resmi.
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {settings.enabled ? (
          <button
            type="button"
            onClick={() => {
              update({ enabled: false });
              setMessage("Notifikasi browser dimatikan.");
            }}
            className="rounded-md border border-red-400/60 px-3 py-1.5 text-xs text-red-400 hover:bg-red-500/10"
          >
            Matikan notifikasi
          </button>
        ) : (
          <button
            type="button"
            onClick={() => void enable()}
            className="rounded-md border border-accent bg-accent/10 px-3 py-1.5 text-xs text-accent hover:bg-accent/20"
          >
            Aktifkan notifikasi
          </button>
        )}
        <button
          type="button"
          onClick={() => void sendBrowserTest()}
          className="rounded-md border border-border px-3 py-1.5 text-xs text-foreground hover:border-accent hover:text-accent"
        >
          Kirim notifikasi uji
        </button>
        {message && (
          <span className="text-xs text-muted">{message}</span>
        )}
      </div>

      <p className="mt-2 text-xs leading-relaxed text-muted">
        Tombol uji sekaligus meminta izin bila belum diberikan. Bila browser
        menolak, atur lewat ikon gembok pada address bar. Di beberapa sistem,
        notifikasi bisa disembunyikan oleh mode “Jangan Ganggu”.
      </p>

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
            className="h-3 w-3 accent-[#38bdf8]"
          />
          Hanya potensi tsunami
        </label>
        <label className="mt-5 flex items-center gap-1.5 text-xs text-muted">
          <input
            type="checkbox"
            checked={settings.feltOnly}
            onChange={(event) => update({ feltOnly: event.target.checked })}
            className="h-3 w-3 accent-[#38bdf8]"
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
