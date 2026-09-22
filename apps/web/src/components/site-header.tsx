import Link from "next/link";

const NAV = [
  { href: "/", label: "Beranda" },
  { href: "/riwayat", label: "Riwayat" },
  { href: "/statistik", label: "Statistik" },
  { href: "/provinsi", label: "Provinsi" },
  { href: "/notifikasi", label: "Notifikasi" },
];

export function SiteHeader() {
  return (
    <header className="flex items-center justify-between border-b border-border bg-surface px-4 py-3">
      <div className="flex items-center gap-4">
        <Link href="/" className="flex items-center gap-3">
          <span className="text-base font-semibold tracking-[0.2em] text-foreground">
            INDOQUAKE
          </span>
        </Link>
        <nav className="hidden items-center gap-3 text-xs sm:flex">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-muted transition-colors hover:text-foreground"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
      <div className="flex items-center gap-3 text-xs">
        <span className="flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-muted">
          <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
          LIVE
        </span>
        <a
          href="https://data.bmkg.go.id/gempabumi/"
          target="_blank"
          rel="noreferrer"
          className="hidden text-muted hover:text-foreground sm:inline"
        >
          Sumber: BMKG
        </a>
      </div>
    </header>
  );
}
