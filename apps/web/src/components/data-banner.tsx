"use client";

import { BMKG_HOME_URL } from "@/lib/site";
import { formatWibHourMinute } from "@/lib/wib";
import { useLive } from "./live-provider";

export function DataBanner() {
  const { freshness } = useLive();
  if (freshness?.state !== "down") return null;
  const since = freshness.lastSuccessAt ? ` sejak ${formatWibHourMinute(freshness.lastSuccessAt)}` : "";
  return (
    <div role="alert" className="border-b border-danger bg-danger-soft">
      <p className="mx-auto max-w-screen-2xl px-4 py-2 text-sm text-foreground">
        Data BMKG belum diperbarui{since}.{" "}
        <a href={BMKG_HOME_URL} className="font-semibold text-danger underline underline-offset-2" rel="noreferrer">
          Ikuti informasi resmi BMKG.
        </a>
      </p>
    </div>
  );
}
