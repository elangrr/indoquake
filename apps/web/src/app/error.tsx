"use client";

import { ErrorState } from "@/components/error-state";

export default function RouteError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="mx-auto w-full max-w-screen-md px-4 py-12">
      <ErrorState onRetry={reset} />
    </div>
  );
}
