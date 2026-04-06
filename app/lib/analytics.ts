declare global {
  interface Window {
    plausible?: (name: string, options?: { props: Record<string, string> }) => void;
  }
}

export function trackEvent(name: string, props?: Record<string, string>): void {
  if (typeof window !== "undefined" && window.plausible) {
    window.plausible(name, props ? { props } : undefined);
  }
}

// Key events to track across the app:
// - 'Export Plugin'   — user exports a plugin configuration
// - 'Import Plugin'   — user imports an existing plugin
// - 'Create Node'     — user creates a new node in the builder
// - 'Load Template'   — user loads a pre-built template
// - 'Share URL'       — user generates a shareable URL (Phase 2)
