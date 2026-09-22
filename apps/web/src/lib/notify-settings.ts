export interface BrowserNotifySettings {
  enabled: boolean;
  minMagnitude: number;
  tsunamiOnly: boolean;
  feltOnly: boolean;
  maxDistanceKm: number | null;
}

const STORAGE_KEY = "indoquake:notify-settings";
const CHANGE_EVENT = "indoquake:notify-settings-changed";

export const DEFAULT_NOTIFY_SETTINGS: BrowserNotifySettings = {
  enabled: false,
  minMagnitude: 4.5,
  tsunamiOnly: false,
  feltOnly: false,
  maxDistanceKm: null,
};

function parse(raw: string | null): BrowserNotifySettings {
  if (!raw) return DEFAULT_NOTIFY_SETTINGS;
  try {
    return {
      ...DEFAULT_NOTIFY_SETTINGS,
      ...(JSON.parse(raw) as Partial<BrowserNotifySettings>),
    };
  } catch {
    return DEFAULT_NOTIFY_SETTINGS;
  }
}

let cachedRaw: string | null | undefined;
let cachedValue: BrowserNotifySettings = DEFAULT_NOTIFY_SETTINGS;

export function getNotifySettingsSnapshot(): BrowserNotifySettings {
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cachedValue = parse(raw);
  }
  return cachedValue;
}

export function getNotifySettingsServerSnapshot(): BrowserNotifySettings {
  return DEFAULT_NOTIFY_SETTINGS;
}

export function subscribeNotifySettings(callback: () => void): () => void {
  window.addEventListener(CHANGE_EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(CHANGE_EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}

export function writeNotifySettings(settings: BrowserNotifySettings): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    cachedRaw = undefined;
    window.dispatchEvent(new Event(CHANGE_EVENT));
  } catch {
    // localStorage tidak tersedia
  }
}

export function readNotifySettings(): BrowserNotifySettings {
  if (typeof window === "undefined") return DEFAULT_NOTIFY_SETTINGS;
  try {
    return parse(window.localStorage.getItem(STORAGE_KEY));
  } catch {
    return DEFAULT_NOTIFY_SETTINGS;
  }
}

export function getNotificationPermission():
  | NotificationPermission
  | "unsupported" {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return "unsupported";
  }
  return window.Notification.permission;
}
