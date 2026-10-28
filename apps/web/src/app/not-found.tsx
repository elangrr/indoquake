import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto w-full max-w-screen-md px-4 py-12">
      <h1 className="text-2xl font-semibold">Halaman tidak ditemukan</h1>
      <p className="mt-2 text-muted">Alamat ini tidak ada atau gempanya tidak tercatat.</p>
      <Link
        href="/"
        className="mt-6 inline-flex min-h-11 items-center rounded-sm bg-foreground px-4 text-sm font-medium text-background"
      >
        Ke beranda
      </Link>
    </div>
  );
}
