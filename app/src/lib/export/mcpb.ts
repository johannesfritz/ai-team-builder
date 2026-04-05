// MCPB Bundle Export — generates a ZIP file containing plugin files + manifest
// MCPB = MCP Bundle, a distribution format for Claude Code plugins

import JSZip from 'jszip';
import type { PluginFile } from './serialize';

export interface McpbManifest {
  name: string;
  version: string;
  description: string;
  files: string[];
}

export async function generateMcpbBundle(
  files: PluginFile[],
  pluginName: string,
  pluginVersion: string = '1.0.0',
  pluginDescription: string = '',
): Promise<Blob> {
  const zip = new JSZip();

  // Add all plugin files
  for (const file of files) {
    zip.file(file.path, file.content);
  }

  // Generate and add manifest
  const manifest: McpbManifest = {
    name: pluginName,
    version: pluginVersion,
    description: pluginDescription,
    files: files.map(f => f.path),
  };
  zip.file('manifest.json', JSON.stringify(manifest, null, 2));

  return zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
}

export async function generateMcpbBuffer(
  files: PluginFile[],
  pluginName: string,
  pluginVersion: string = '1.0.0',
  pluginDescription: string = '',
): Promise<Uint8Array> {
  const zip = new JSZip();
  for (const file of files) {
    zip.file(file.path, file.content);
  }
  const manifest: McpbManifest = {
    name: pluginName,
    version: pluginVersion,
    description: pluginDescription,
    files: files.map(f => f.path),
  };
  zip.file('manifest.json', JSON.stringify(manifest, null, 2));
  return zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
