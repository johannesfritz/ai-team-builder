// Runtime helper for prefixing static asset paths with the Next.js basePath.
// basePath is set in next.config.ts to '/ai-team-builder' in production.
// Next.js does NOT auto-rewrite <img src="/..."> tags — we have to do it ourselves.

const BASE_PATH = process.env.NODE_ENV === 'production' ? '/ai-team-builder' : '';

export function assetPath(relPath: string): string {
  const rel = relPath.startsWith('/') ? relPath : `/${relPath}`;
  return `${BASE_PATH}${rel}`;
}
