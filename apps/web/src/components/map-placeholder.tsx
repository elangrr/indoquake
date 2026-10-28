export function MapPlaceholder() {
  return (
    <div data-testid="map-placeholder" className="absolute inset-0 bg-surface-2">
      <svg aria-hidden="true" className="h-full w-full text-border" preserveAspectRatio="none">
        <defs>
          <pattern id="iq-grid" width="48" height="48" patternUnits="userSpaceOnUse">
            <path d="M48 0H0V48" fill="none" stroke="currentColor" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#iq-grid)" />
      </svg>
      <p className="absolute inset-x-0 top-1/2 text-center text-sm text-muted">Memuat peta</p>
    </div>
  );
}
