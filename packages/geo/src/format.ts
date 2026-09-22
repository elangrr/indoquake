export function formatDurationId(totalSeconds: number): string {
  const seconds = Math.max(0, Math.round(totalSeconds));
  if (seconds < 60) return `${seconds} detik`;
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return remainder === 0
    ? `${minutes} menit`
    : `${minutes} mnt ${remainder} dtk`;
}

export function formatDistanceKm(km: number): string {
  return `${Math.round(km).toLocaleString("id-ID")} km`;
}
