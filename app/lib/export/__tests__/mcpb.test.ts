import { describe, it, expect } from 'vitest';
import JSZip from 'jszip';
import { generateMcpbBuffer } from '../mcpb';
import type { PluginFile } from '../serialize';

describe('generateMcpbBundle', () => {
  const sampleFiles: PluginFile[] = [
    { path: 'plugin.json', content: '{"name":"test"}' },
    { path: 'rules/code-standards.md', content: '# Standards\nUse TypeScript.' },
    { path: 'commands/review.md', content: 'Review the code.' },
  ];

  it('generates a non-empty buffer', async () => {
    const buf = await generateMcpbBuffer(sampleFiles, 'test-plugin', '1.0.0', 'A test plugin');
    expect(buf).toBeInstanceOf(Uint8Array);
    expect(buf.length).toBeGreaterThan(0);
  });

  it('includes all files plus manifest', async () => {
    const buf = await generateMcpbBuffer(sampleFiles, 'test-plugin');
    const zip = await JSZip.loadAsync(buf);
    const fileNames = Object.keys(zip.files);
    expect(fileNames).toContain('plugin.json');
    expect(fileNames).toContain('rules/code-standards.md');
    expect(fileNames).toContain('commands/review.md');
    expect(fileNames).toContain('manifest.json');
  });

  it('manifest contains correct metadata', async () => {
    const buf = await generateMcpbBuffer(sampleFiles, 'my-tool', '2.0.0', 'My description');
    const zip = await JSZip.loadAsync(buf);
    const manifestContent = await zip.file('manifest.json')!.async('string');
    const manifest = JSON.parse(manifestContent);
    expect(manifest.name).toBe('my-tool');
    expect(manifest.version).toBe('2.0.0');
    expect(manifest.description).toBe('My description');
    expect(manifest.files).toHaveLength(3);
    expect(manifest.files).toContain('rules/code-standards.md');
  });

  it('preserves file content', async () => {
    const buf = await generateMcpbBuffer(sampleFiles, 'test');
    const zip = await JSZip.loadAsync(buf);
    const ruleContent = await zip.file('rules/code-standards.md')!.async('string');
    expect(ruleContent).toBe('# Standards\nUse TypeScript.');
  });

  it('handles empty file list', async () => {
    const buf = await generateMcpbBuffer([], 'empty-plugin');
    const zip = await JSZip.loadAsync(buf);
    const fileNames = Object.keys(zip.files);
    expect(fileNames).toContain('manifest.json');
    const manifest = JSON.parse(await zip.file('manifest.json')!.async('string'));
    expect(manifest.files).toHaveLength(0);
  });
});
