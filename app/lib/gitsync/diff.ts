// File-map diff for the Git Sync dirty counter and save payload.

export interface FileMap {
  [path: string]: string;
}

export interface FileMapDiff {
  added: string[];
  modified: string[];
  deleted: string[];
}

/**
 * Compare two file maps. Returns lists of changed paths.
 */
export function diffFileMaps(oldMap: FileMap, newMap: FileMap): FileMapDiff {
  const oldKeys = new Set(Object.keys(oldMap));
  const newKeys = new Set(Object.keys(newMap));
  const added: string[] = [];
  const modified: string[] = [];
  const deleted: string[] = [];

  for (const k of newKeys) {
    if (!oldKeys.has(k)) added.push(k);
    else if (oldMap[k] !== newMap[k]) modified.push(k);
  }
  for (const k of oldKeys) {
    if (!newKeys.has(k)) deleted.push(k);
  }

  added.sort();
  modified.sort();
  deleted.sort();
  return { added, modified, deleted };
}

/**
 * Total number of changed file paths across added/modified/deleted.
 */
export function changedFileCount(diff: FileMapDiff): number {
  return diff.added.length + diff.modified.length + diff.deleted.length;
}

/**
 * Produce a human-readable diff summary suitable for a commit message.
 * Groups entries by type prefix (agents/, skills/, rules/, commands/, hooks/).
 */
export function summarizeDiff(diff: FileMapDiff): string {
  const parts: string[] = [];

  function summarizePaths(verb: 'added' | 'updated' | 'removed', paths: string[]): void {
    if (!paths.length) return;
    const items = paths.map(p => {
      const parts = p.split('/');
      // Detect common prefixes: rules/, skills/, commands/, agents/, hooks/
      for (let i = 0; i < parts.length; i++) {
        const seg = parts[i];
        if (['rules', 'skills', 'commands', 'agents', 'hooks'].includes(seg)) {
          const typ = seg.slice(0, -1); // 'agents' → 'agent'
          const rest = parts.slice(i + 1).join('/').replace(/\.md$/, '').replace(/\/SKILL$/, '');
          return `${typ} ${rest}`;
        }
      }
      return p;
    });
    parts.push(`${verb} ${items.join(', ')}`);
  }

  summarizePaths('added', diff.added);
  summarizePaths('updated', diff.modified);
  summarizePaths('removed', diff.deleted);

  if (!parts.length) return 'no changes';
  return parts.join('; ');
}

/**
 * Build the full commit message with footer.
 */
export function buildCommitMessage(diff: FileMapDiff): string {
  const summary = summarizeDiff(diff);
  const title = truncate(`Update via AI Team Builder: ${summary}`, 72);

  const bodyLines: string[] = [];
  if (diff.added.length) bodyLines.push('Added:', ...diff.added.map(p => `  + ${p}`));
  if (diff.modified.length) bodyLines.push('Modified:', ...diff.modified.map(p => `  ~ ${p}`));
  if (diff.deleted.length) bodyLines.push('Deleted:', ...diff.deleted.map(p => `  - ${p}`));
  bodyLines.push('');
  bodyLines.push('Co-Authored-By: AI Team Builder <noreply@ai-team-builder.dev>');

  return `${title}\n\n${bodyLines.join('\n')}`;
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max - 1) + '…';
}
