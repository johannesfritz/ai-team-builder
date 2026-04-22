// Deterministic, short hash for cache invalidation tracking.
// Not cryptographic — just content-equality identity over prompts and inputs.

/**
 * SHA-256 of the UTF-8-encoded string, returned as the first 16 hex chars.
 * Collision risk is negligible for our sample size (a single Live Test session
 * has at most ~50 distinct strings).
 */
export async function shortHash(s: string): Promise<string> {
  if (typeof crypto === 'undefined' || !crypto.subtle) {
    // Fallback for Node tests without Web Crypto shim: a stable djb2 on the string.
    // Production (browser) always has crypto.subtle.
    let h = 5381;
    for (let i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0;
    return h.toString(16).padStart(16, '0').slice(0, 16);
  }
  const data = new TextEncoder().encode(s);
  const digest = await crypto.subtle.digest('SHA-256', data);
  const arr = new Uint8Array(digest);
  let hex = '';
  for (let i = 0; i < 8; i++) hex += arr[i].toString(16).padStart(2, '0');
  return hex;
}
