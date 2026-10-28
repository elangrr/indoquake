import Link from "next/link";

export function Pager({
  page,
  totalPages,
  hrefFor,
}: {
  page: number;
  totalPages: number;
  hrefFor: (page: number) => string;
}) {
  if (totalPages <= 1) return null;
  const linkClass =
    "inline-flex min-h-11 min-w-11 items-center justify-center rounded-sm border border-border px-4 text-sm text-foreground transition-colors duration-150 hover:bg-surface-2";
  return (
    <nav aria-label="Halaman" className="flex items-center justify-between gap-4 px-4 py-4">
      {page > 1 ? (
        <Link href={hrefFor(page - 1)} className={linkClass} rel="prev">
          Sebelumnya
        </Link>
      ) : (
        <span />
      )}
      <p className="num text-sm text-muted" aria-current="page">
        Halaman {page.toLocaleString("id-ID")} dari {totalPages.toLocaleString("id-ID")}
      </p>
      {page < totalPages ? (
        <Link href={hrefFor(page + 1)} className={linkClass} rel="next">
          Berikutnya
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}
