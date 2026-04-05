import LZString from 'lz-string';

const SHARE_VERSION = 'v1';
const MAX_URL_HASH_LENGTH = 4000;

export interface ShareableState {
  nodes: unknown[];
  edges: unknown[];
  meta: { name: string; description: string };
}

export function encodeShareURL(state: ShareableState, baseUrl: string): { url: string; method: 'hash' } | { error: string } {
  const json = JSON.stringify(state);
  const compressed = LZString.compressToEncodedURIComponent(json);
  const hash = `${SHARE_VERSION}:${compressed}`;

  if (hash.length > MAX_URL_HASH_LENGTH) {
    return { error: `Plugin too large for URL sharing (${hash.length} chars). Export to GitHub or download the JSON file instead.` };
  }

  return { url: `${baseUrl}#${hash}`, method: 'hash' };
}

export function decodeShareURL(hash: string): ShareableState | { error: string } {
  if (!hash) return { error: 'Invalid share URL format' };
  if (hash.startsWith('#')) hash = hash.slice(1);
  if (!hash) return { error: 'Invalid share URL format' };

  const versionMatch = hash.match(/^(v\d+):(.*)/);
  if (!versionMatch) {
    return { error: 'Invalid share URL format' };
  }

  const [, version, compressed] = versionMatch;
  if (version !== SHARE_VERSION) {
    return { error: `Unsupported share URL version: ${version}` };
  }

  try {
    const json = LZString.decompressFromEncodedURIComponent(compressed);
    if (!json) return { error: 'Could not decompress share data' };

    const state = JSON.parse(json) as ShareableState;
    if (!Array.isArray(state.nodes) || !Array.isArray(state.edges)) {
      return { error: 'Invalid share data structure' };
    }

    return state;
  } catch {
    return { error: 'Corrupted share URL' };
  }
}
