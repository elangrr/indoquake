export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-screen-md px-4 py-12" aria-busy="true">
      <span className="sr-only">Memuat</span>
      <div className="h-8 w-48 rounded-sm bg-surface-2" />
      <div className="mt-4 h-4 w-full max-w-md rounded-sm bg-surface-2" />
      <div className="mt-2 h-4 w-full max-w-sm rounded-sm bg-surface-2" />
    </div>
  );
}
