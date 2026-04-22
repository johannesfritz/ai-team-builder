// Git Sync types shared across gitsync/ modules.

export interface RepoConnection {
  owner: string;
  repo: string;
  branch: string;
  lastFetchedSha: string;
  pluginRoot: string;  // '' for root-level plugins, '.claude-plugin' for standard layout
  loadedAt: number;    // ms epoch
  // Optional: the file map captured at load time. Used to compute dirty diff.
  loadedFileMap?: Record<string, string>;
}

export type SaveStatus = 'clean' | 'dirty' | 'saving' | 'conflict' | 'error';

export interface SaveError {
  kind: 'network' | 'rate_limit' | 'branch_protected' | 'unauthorized' | 'stale_sha' | 'unknown';
  message: string;
  httpStatus?: number;
}

export interface SaveResult {
  ok: true;
  newCommitSha: string;
  commitUrl: string;
}

export interface SaveFailure {
  ok: false;
  error: SaveError;
  // When kind === 'stale_sha', this is the branch HEAD the user needs to refresh to.
  serverHeadSha?: string;
}

export type SaveOutcome = SaveResult | SaveFailure;
