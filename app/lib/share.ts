import LZString from 'lz-string';

const SHARE_VERSION = 'v1';
const MAX_URL_HASH_LENGTH = 4000;
const API_BASE = '/ai-team-builder/api';

export interface ShareableState {
  nodes: unknown[];
  edges: unknown[];
  meta: { name: string; description: string };
}

/**
 * Create a secret Gist via the proxy with the shareable state.
 * Returns the share URL with `#gist:{id}` format.
 */
export async function createShareGist(
  state: ShareableState,
  token: string,
): Promise<{ url: string; method: 'gist' } | { error: string }> {
  const json = JSON.stringify(state, null, 2);
  const body = {
    description: `AI Team Builder plugin: ${state.meta.name}`,
    public: false,
    files: {
      'plugin.json': { content: json },
    },
  };

  const resp = await fetch(`${API_BASE}/github/gists`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const data = await resp.json().catch(() => ({}));
    return { error: (data as Record<string, string>).error ?? `Gist creation failed (${resp.status})` };
  }

  const data = (await resp.json()) as { id: string };
  const baseUrl = `${window.location.origin}/ai-team-builder/builder`;
  return { url: `${baseUrl}#gist:${data.id}`, method: 'gist' };
}

/**
 * Load a shared state from a Gist by its ID.
 */
export async function loadFromGist(
  gistId: string,
): Promise<ShareableState | { error: string }> {
  const resp = await fetch(`https://api.github.com/gists/${gistId}`, {
    headers: { Accept: 'application/vnd.github+json' },
  });

  if (!resp.ok) {
    return { error: `Could not load Gist (${resp.status})` };
  }

  const data = (await resp.json()) as {
    files: Record<string, { content: string }>;
  };
  const file = data.files['plugin.json'];
  if (!file) {
    return { error: 'Gist does not contain plugin data' };
  }

  try {
    const state = JSON.parse(file.content) as ShareableState;
    if (!Array.isArray(state.nodes) || !Array.isArray(state.edges)) {
      return { error: 'Invalid share data structure in Gist' };
    }
    return state;
  } catch {
    return { error: 'Corrupted Gist data' };
  }
}

/**
 * Encode shareable state into a URL.
 * If the hash exceeds the size limit and a GitHub token is provided,
 * falls back to creating a secret Gist.
 */
export async function encodeShareURL(
  state: ShareableState,
  baseUrl: string,
  githubToken?: string,
): Promise<{ url: string; method: 'hash' | 'gist' } | { error: string }> {
  const json = JSON.stringify(state);
  const compressed = LZString.compressToEncodedURIComponent(json);
  const hash = `${SHARE_VERSION}:${compressed}`;

  if (hash.length <= MAX_URL_HASH_LENGTH) {
    return { url: `${baseUrl}#${hash}`, method: 'hash' };
  }

  if (githubToken) {
    return createShareGist(state, githubToken);
  }

  return {
    error: `Plugin too large for URL sharing (${hash.length} chars). Connect GitHub to use Gist sharing, or download the JSON file instead.`,
  };
}

/**
 * Decode a share URL hash. Supports both `v1:...` compressed format
 * and `gist:{gistId}` format.
 */
export async function decodeShareURL(
  hash: string,
): Promise<ShareableState | { error: string }> {
  if (!hash) return { error: 'Invalid share URL format' };
  if (hash.startsWith('#')) hash = hash.slice(1);
  if (!hash) return { error: 'Invalid share URL format' };

  // Handle gist:{id} format
  const gistMatch = hash.match(/^gist:([a-f0-9]+)$/);
  if (gistMatch) {
    return loadFromGist(gistMatch[1]);
  }

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
