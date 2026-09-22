"use client";

import { useState } from "react";
import { PROVINCE_OPTIONS } from "@indoquake/regions";

const inputClass =
  "mt-1 w-full rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground outline-none focus:border-accent";

const botUsername = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME;

interface SavedSubscription {
  id: number;
  channel: string;
  target: string;
  minMagnitude: number;
}

export function SubscriptionForm() {
  const [channel, setChannel] = useState<"telegram" | "discord">("telegram");
  const [target, setTarget] = useState("");
  const [minMagnitude, setMinMagnitude] = useState(4.5);
  const [maxDistanceKm, setMaxDistanceKm] = useState<string>("");
  const [provinceSlug, setProvinceSlug] = useState("");
  const [tsunamiOnly, setTsunamiOnly] = useState(false);
  const [feltOnly, setFeltOnly] = useState(false);
  const [useLocation, setUseLocation] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<SavedSubscription | null>(null);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);

  const sendTest = async () => {
    setTestResult(null);
    setTesting(true);
    try {
      const response = await fetch("/api/v1/subscriptions/test", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ channel, target }),
      });
      const json = (await response.json()) as { ok?: boolean; error?: string };
      setTestResult(
        response.ok && json.ok
          ? "✅ Notifikasi uji terkirim — cek kanal Anda."
          : `❌ ${json.error ?? "Gagal mengirim notifikasi uji."}`,
      );
    } catch {
      setTestResult("❌ Gagal menghubungi server.");
    } finally {
      setTesting(false);
    }
  };

  const submit = async () => {
    setStatus(null);
    setError(null);

    let latitude: number | null = null;
    let longitude: number | null = null;
    if (useLocation) {
      try {
        const raw = window.sessionStorage.getItem("indoquake:user-location");
        if (raw) {
          const parsed = JSON.parse(raw) as {
            latitude: number;
            longitude: number;
          };
          latitude = parsed.latitude;
          longitude = parsed.longitude;
        }
      } catch {
        // abaikan
      }
      if (latitude === null) {
        setError(
          "Lokasi belum aktif. Aktifkan lokasi di beranda terlebih dahulu.",
        );
        return;
      }
    }

    setStatus("Menyimpan…");
    try {
      const response = await fetch("/api/v1/subscriptions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          channel,
          target,
          minMagnitude,
          maxDistanceKm: maxDistanceKm === "" ? null : Number(maxDistanceKm),
          provinceSlug: provinceSlug || null,
          tsunamiOnly,
          feltOnly,
          latitude,
          longitude,
        }),
      });
      const json = (await response.json()) as {
        data?: SavedSubscription;
        error?: string;
      };
      if (!response.ok || !json.data) {
        setError(json.error ?? "Gagal menyimpan langganan.");
        setStatus(null);
        return;
      }
      setSaved(json.data);
      setStatus("Langganan tersimpan.");
    } catch {
      setError("Gagal menghubungi server.");
      setStatus(null);
    }
  };

  const remove = async () => {
    if (!saved) return;
    setStatus("Menghapus…");
    try {
      await fetch(
        `/api/v1/subscriptions?id=${saved.id}&target=${encodeURIComponent(saved.target)}`,
        { method: "DELETE" },
      );
      setSaved(null);
      setStatus("Langganan dihapus.");
    } catch {
      setError("Gagal menghapus langganan.");
      setStatus(null);
    }
  };

  return (
    <section className="rounded-lg border border-border bg-surface p-4">
      <h2 className="text-sm font-semibold text-foreground">
        Langganan Telegram / Discord
      </h2>
      <p className="mt-1 text-[11px] leading-relaxed text-muted">
        Kirim notifikasi otomatis dari server saat ada gempa baru yang cocok.
        Isi notifikasi selalu mencantumkan sumber BMKG dan menegaskan bahwa ini
        bukan peringatan resmi.
      </p>

      <div className="mt-3 flex gap-1.5">
        {(["telegram", "discord"] as const).map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setChannel(item)}
            className={
              channel === item
                ? "rounded-full border border-accent bg-accent/10 px-2.5 py-1 text-[11px] text-accent"
                : "rounded-full border border-border px-2.5 py-1 text-[11px] text-muted hover:text-foreground"
            }
          >
            {item === "telegram" ? "Telegram" : "Discord"}
          </button>
        ))}
      </div>

      {channel === "telegram" && (
        <div className="mt-3 rounded-md border border-border bg-surface-2 px-3 py-2">
          {botUsername ? (
            <>
              <p className="text-[11px] font-medium text-foreground">
                Cara termudah — tanpa perlu Chat ID
              </p>
              <p className="mt-1 text-[11px] leading-relaxed text-muted">
                Buka bot, lalu kirim <code>/langganan</code> (atau{" "}
                <code>/langganan M5</code>). Langganan langsung aktif untuk chat
                Anda.
              </p>
              <a
                href={`https://t.me/${botUsername}`}
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-block rounded-md border border-accent bg-accent/10 px-3 py-1.5 text-xs text-accent hover:bg-accent/20"
              >
                Buka @{botUsername} di Telegram →
              </a>
              <p className="mt-2 text-[10px] text-muted">
                Butuh Chat ID (mis. untuk ambang radius)? Kirim{" "}
                <code>/id</code> ke bot.
              </p>
            </>
          ) : (
            <p className="text-[11px] leading-relaxed text-amber-300">
              Kanal Telegram belum dikonfigurasi oleh pengelola situs (bot token
              belum diisi). Silakan pakai <strong>Discord</strong> atau{" "}
              <strong>notifikasi browser</strong>.
            </p>
          )}
        </div>
      )}

      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="text-[11px] text-muted sm:col-span-2">
          {channel === "telegram"
            ? "Chat ID Telegram"
            : "URL Webhook Discord"}
          <input
            value={target}
            onChange={(event) => setTarget(event.target.value)}
            placeholder={
              channel === "telegram"
                ? "123456789"
                : "https://discord.com/api/webhooks/…"
            }
            className={inputClass}
          />
        </label>
        <label className="text-[11px] text-muted">
          Magnitudo minimum
          <input
            type="number"
            step="0.1"
            min={0}
            max={10}
            value={minMagnitude}
            onChange={(event) => setMinMagnitude(Number(event.target.value))}
            className={inputClass}
          />
        </label>
        <label className="text-[11px] text-muted">
          Radius maksimum (km)
          <input
            type="number"
            min={1}
            max={2000}
            placeholder="semua"
            value={maxDistanceKm}
            onChange={(event) => setMaxDistanceKm(event.target.value)}
            className={inputClass}
          />
        </label>
        <label className="text-[11px] text-muted">
          Provinsi (opsional)
          <select
            value={provinceSlug}
            onChange={(event) => setProvinceSlug(event.target.value)}
            className={inputClass}
          >
            <option value="">Semua provinsi</option>
            {PROVINCE_OPTIONS.map((province) => (
              <option key={province.slug} value={province.slug}>
                {province.name}
              </option>
            ))}
          </select>
        </label>
        <div className="flex flex-col justify-end gap-1.5 text-[11px] text-muted">
          <label className="flex items-center gap-1.5">
            <input
              type="checkbox"
              checked={tsunamiOnly}
              onChange={(event) => setTsunamiOnly(event.target.checked)}
              className="h-3 w-3 accent-[#38bdf8]"
            />
            Hanya potensi tsunami
          </label>
          <label className="flex items-center gap-1.5">
            <input
              type="checkbox"
              checked={feltOnly}
              onChange={(event) => setFeltOnly(event.target.checked)}
              className="h-3 w-3 accent-[#38bdf8]"
            />
            Hanya dirasakan
          </label>
          <label className="flex items-center gap-1.5">
            <input
              type="checkbox"
              checked={useLocation}
              onChange={(event) => setUseLocation(event.target.checked)}
              className="h-3 w-3 accent-[#38bdf8]"
            />
            Pakai lokasi saya untuk filter radius
          </label>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => void submit()}
          className="rounded-md border border-accent bg-accent/10 px-3 py-1.5 text-xs text-accent hover:bg-accent/20"
        >
          Simpan langganan
        </button>
        <button
          type="button"
          onClick={() => void sendTest()}
          disabled={testing || target.trim() === ""}
          className="rounded-md border border-border px-3 py-1.5 text-xs text-foreground hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-40"
        >
          {testing ? "Mengirim…" : "Kirim notifikasi uji"}
        </button>
        {saved && (
          <button
            type="button"
            onClick={() => void remove()}
            className="rounded-md border border-red-400/60 px-3 py-1.5 text-xs text-red-400 hover:bg-red-500/10"
          >
            Hapus langganan #{saved.id}
          </button>
        )}
        {status && <span className="text-[11px] text-muted">{status}</span>}
      </div>
      {testResult && (
        <p className="mt-2 text-[11px] text-foreground">{testResult}</p>
      )}
      {error && <p className="mt-2 text-[11px] text-red-400">{error}</p>}
      <p className="mt-2 text-[10px] leading-relaxed text-muted">
        Tombol uji mengirim pesan contoh (bukan gempa nyata) ke kanal di atas —
        tidak perlu menyimpan langganan lebih dulu.
      </p>

      {channel === "telegram" && botUsername && (
        <p className="mt-2 text-[10px] leading-relaxed text-muted">
          Alternatif: masukkan Chat ID di atas untuk ambang radius/provinsi yang
          lebih rinci. Bot server dikonfigurasi lewat{" "}
          <code>TELEGRAM_BOT_TOKEN</code>.
        </p>
      )}
    </section>
  );
}
