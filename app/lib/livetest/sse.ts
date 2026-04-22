// SSE parser for Anthropic event stream. Reference:
// https://docs.anthropic.com/en/api/messages-streaming
//
// Events emitted by Anthropic: message_start, content_block_start, content_block_delta
// (text_delta | input_json_delta | tool_use), content_block_stop, message_delta, message_stop,
// plus ping heartbeats every ~15s, plus error events.
//
// This parser splits the stream on "\n\n" record terminators, then extracts event/data lines.

export interface SseEvent {
  event: string;
  data: unknown;
}

/**
 * Parse a single SSE record (text between two "\n\n" terminators).
 * Returns null if the record is malformed or empty.
 */
export function parseSseRecord(record: string): SseEvent | null {
  if (!record.trim()) return null;
  let eventName = 'message';
  let dataLines: string[] = [];
  for (const line of record.split('\n')) {
    if (line.startsWith('event:')) eventName = line.slice(6).trim();
    else if (line.startsWith('data:')) dataLines.push(line.slice(5).trim());
  }
  if (!dataLines.length) return null;
  const joined = dataLines.join('\n');
  try {
    return { event: eventName, data: JSON.parse(joined) };
  } catch {
    // Some events (ping) can have non-JSON data; keep the raw string.
    return { event: eventName, data: joined };
  }
}

export interface StreamHandlers {
  onMessageStart?: (msg: { usage: { input_tokens: number } }) => void;
  onTextDelta?: (text: string) => void;
  onToolUseDelta?: (partialJson: string) => void;
  onContentBlockStart?: (block: { type: string; name?: string }) => void;
  onMessageDelta?: (usage: { output_tokens: number }) => void;
  onMessageStop?: () => void;
  onError?: (err: { type: string; message: string }) => void;
}

/**
 * Consume an SSE response body and dispatch handlers for each event type.
 * Respects the AbortController attached to the fetch — when signal aborts,
 * the reader throws and we propagate cleanly.
 *
 * Returns when the stream ends (message_stop or the reader is done).
 */
export async function consumeAnthropicStream(
  body: ReadableStream<Uint8Array>,
  handlers: StreamHandlers,
): Promise<void> {
  const reader = body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';
  let chunkCount = 0;
  let recordCount = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        if (typeof console !== 'undefined') console.debug(`[livetest sse] stream done. chunks=${chunkCount} records=${recordCount} buffer-tail=${JSON.stringify(buffer.slice(0, 80))}`);
        break;
      }
      chunkCount++;
      const decoded = decoder.decode(value, { stream: true });
      buffer += decoded;
      if (typeof console !== 'undefined' && chunkCount === 1) console.debug(`[livetest sse] first chunk ${decoded.length}B starts with`, decoded.slice(0, 80));
      let nlIdx: number;
      while ((nlIdx = buffer.indexOf('\n\n')) !== -1) {
        const record = buffer.slice(0, nlIdx);
        buffer = buffer.slice(nlIdx + 2);
        const parsed = parseSseRecord(record);
        if (!parsed) continue;
        recordCount++;
        if (typeof console !== 'undefined' && recordCount <= 3) console.debug(`[livetest sse] record #${recordCount} event=${parsed.event}`);
        dispatch(parsed, handlers);
      }
    }
  } finally {
    try { reader.releaseLock(); } catch { /* noop */ }
  }
}

function dispatch(evt: SseEvent, h: StreamHandlers): void {
  const d = evt.data as Record<string, unknown>;
  switch (evt.event) {
    case 'message_start':
      if (d && d.message && (d.message as { usage?: unknown }).usage) {
        h.onMessageStart?.(d.message as { usage: { input_tokens: number } });
      }
      break;
    case 'content_block_start': {
      const block = d.content_block as { type: string; name?: string } | undefined;
      if (block) h.onContentBlockStart?.(block);
      break;
    }
    case 'content_block_delta': {
      const delta = d.delta as { type?: string; text?: string; partial_json?: string } | undefined;
      if (!delta) break;
      if (delta.type === 'text_delta' && typeof delta.text === 'string') h.onTextDelta?.(delta.text);
      else if (delta.type === 'input_json_delta' && typeof delta.partial_json === 'string')
        h.onToolUseDelta?.(delta.partial_json);
      break;
    }
    case 'content_block_stop':
      // no-op for v1
      break;
    case 'message_delta': {
      const usage = (d.usage ?? (d.delta as { usage?: unknown })?.usage) as { output_tokens: number } | undefined;
      if (usage) h.onMessageDelta?.(usage);
      break;
    }
    case 'message_stop':
      h.onMessageStop?.();
      break;
    case 'error':
      h.onError?.(d.error as { type: string; message: string });
      break;
    case 'ping':
      // heartbeat, ignore
      break;
    default:
      // forward-compat: log and continue
      if (typeof console !== 'undefined') console.debug('[livetest] unknown SSE event', evt.event);
  }
}
