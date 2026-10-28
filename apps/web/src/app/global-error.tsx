"use client";

import "./globals.css";

export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <html lang="id">
      <head>
        <title>Data belum bisa dimuat · Indoquake</title>
      </head>
      <body className="min-h-dvh">
        <main className="mx-auto max-w-screen-md px-4 py-12">
          <h1 className="text-2xl font-semibold">Indoquake</h1>
          <p className="mt-4">Data belum bisa dimuat. Coba lagi.</p>
          <button
            type="button"
            onClick={reset}
            className="mt-4 min-h-11 rounded-sm bg-foreground px-4 text-sm font-medium text-background"
          >
            Coba lagi
          </button>
        </main>
      </body>
    </html>
  );
}
