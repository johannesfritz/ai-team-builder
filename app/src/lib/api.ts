// API client for the plugin server

const API_BASE = typeof window !== 'undefined'
  ? `${window.location.origin}/ai-team-builder/api`
  : '/ai-team-builder/api';

export interface PluginSummary {
  name: string;
  title: string;
  description: string;
  category: string;
  version: string;
  file_count: number;
}

export interface PluginDetail {
  name: string;
  title: string;
  description: string;
  category: string;
  version: string;
  manifest: Record<string, unknown>;
  files: Array<{ path: string; content: string }>;
  file_count: number;
}

export async function fetchPlugins(): Promise<PluginSummary[]> {
  const res = await fetch(`${API_BASE}/plugins`);
  if (!res.ok) throw new Error(`Failed to fetch plugins: ${res.status}`);
  return res.json();
}

export async function fetchPlugin(name: string): Promise<PluginDetail> {
  const res = await fetch(`${API_BASE}/plugins/${name}`);
  if (!res.ok) throw new Error(`Failed to fetch plugin ${name}: ${res.status}`);
  return res.json();
}
