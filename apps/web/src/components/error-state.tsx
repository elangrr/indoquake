export function ErrorState({
  onRetry,
  message = "Data belum bisa dimuat. Coba lagi.",
}: {
  onRetry: () => void;
  message?: string;
}) {
  return (
    <div role="alert" className="border-l-2 border-danger py-2 pl-4">
      <p className="text-base text-foreground">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-3 min-h-11 rounded-sm border border-border bg-surface px-4 text-sm font-medium text-foreground transition-colors duration-150 hover:bg-surface-2"
      >
        Coba lagi
      </button>
    </div>
  );
}
