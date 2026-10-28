"use client";

import { useCallback, useEffect, useState } from "react";

export type ApiState<T> =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; data: T };

interface Stored<T> {
  key: string;
  state: ApiState<T>;
}

const FALLBACK_ERROR = "Data belum bisa dimuat.";

/** GET a JSON endpoint; the state is keyed by URL so a new URL shows loading at once. */
export function useApi<T>(url: string | null): ApiState<T> & { retry: () => void } {
  const [attempt, setAttempt] = useState(0);
  const [stored, setStored] = useState<Stored<T> | null>(null);
  const key = `${attempt}:${url}`;

  useEffect(() => {
    if (!url) return;
    const controller = new AbortController();
    fetch(url, { signal: controller.signal, cache: "no-store" })
      .then(async (response) => {
        const body = (await response.json().catch(() => null)) as (T & { error?: string }) | null;
        if (!response.ok || body === null) {
          setStored({ key, state: { status: "error", message: FALLBACK_ERROR } });
          return;
        }
        setStored({ key, state: { status: "ready", data: body } });
      })
      .catch((error: unknown) => {
        if ((error as Error)?.name === "AbortError") return;
        setStored({ key, state: { status: "error", message: FALLBACK_ERROR } });
      });
    return () => controller.abort();
  }, [url, key]);

  const retry = useCallback(() => setAttempt((value) => value + 1), []);
  const state: ApiState<T> = stored && stored.key === key ? stored.state : { status: "loading" };
  return { ...state, retry };
}
