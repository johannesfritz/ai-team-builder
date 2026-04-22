import { describe, it, expect, vi } from 'vitest';
import { parseSseRecord, consumeAnthropicStream } from '../sse';

describe('parseSseRecord', () => {
  it('parses a simple event with JSON data', () => {
    const record = 'event: message_stop\ndata: {"type":"message_stop"}';
    expect(parseSseRecord(record)).toEqual({ event: 'message_stop', data: { type: 'message_stop' } });
  });

  it('returns null for empty record', () => {
    expect(parseSseRecord('')).toBeNull();
    expect(parseSseRecord('   ')).toBeNull();
  });

  it('defaults to "message" event when no event line present', () => {
    const record = 'data: {"foo":"bar"}';
    expect(parseSseRecord(record)).toEqual({ event: 'message', data: { foo: 'bar' } });
  });

  it('keeps raw string when data is not JSON', () => {
    const record = 'event: ping\ndata: heartbeat';
    expect(parseSseRecord(record)).toEqual({ event: 'ping', data: 'heartbeat' });
  });

  it('ignores lines not starting with event: or data:', () => {
    const record = 'id: 42\nevent: message_start\n:comment\ndata: {"x":1}';
    expect(parseSseRecord(record)).toEqual({ event: 'message_start', data: { x: 1 } });
  });
});

// Minimal helper to build a ReadableStream<Uint8Array> from a string
function streamFromString(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const c of chunks) controller.enqueue(encoder.encode(c));
      controller.close();
    },
  });
}

describe('consumeAnthropicStream', () => {
  it('dispatches message_start with usage', async () => {
    const onMessageStart = vi.fn();
    const body = streamFromString([
      'event: message_start\ndata: {"type":"message_start","message":{"usage":{"input_tokens":42}}}\n\n',
    ]);
    await consumeAnthropicStream(body, { onMessageStart });
    expect(onMessageStart).toHaveBeenCalledWith({ usage: { input_tokens: 42 } });
  });

  it('dispatches text_delta through onTextDelta', async () => {
    const onTextDelta = vi.fn();
    const body = streamFromString([
      'event: content_block_delta\ndata: {"type":"content_block_delta","delta":{"type":"text_delta","text":"Hello"}}\n\n',
      'event: content_block_delta\ndata: {"type":"content_block_delta","delta":{"type":"text_delta","text":" world"}}\n\n',
    ]);
    await consumeAnthropicStream(body, { onTextDelta });
    expect(onTextDelta).toHaveBeenCalledWith('Hello');
    expect(onTextDelta).toHaveBeenCalledWith(' world');
  });

  it('handles chunks split mid-record', async () => {
    const onTextDelta = vi.fn();
    const body = streamFromString([
      'event: content_block_delta\ndata: {"type":"content_block_delta","delta":{"type":"text_delta","text":"He',
      'llo"}}\n\n',
    ]);
    await consumeAnthropicStream(body, { onTextDelta });
    expect(onTextDelta).toHaveBeenCalledWith('Hello');
  });

  it('dispatches message_delta with output token usage', async () => {
    const onMessageDelta = vi.fn();
    const body = streamFromString([
      'event: message_delta\ndata: {"type":"message_delta","delta":{"stop_reason":"end_turn"},"usage":{"output_tokens":123}}\n\n',
    ]);
    await consumeAnthropicStream(body, { onMessageDelta });
    expect(onMessageDelta).toHaveBeenCalledWith({ output_tokens: 123 });
  });

  it('dispatches message_stop', async () => {
    const onMessageStop = vi.fn();
    const body = streamFromString(['event: message_stop\ndata: {"type":"message_stop"}\n\n']);
    await consumeAnthropicStream(body, { onMessageStop });
    expect(onMessageStop).toHaveBeenCalled();
  });

  it('dispatches error events', async () => {
    const onError = vi.fn();
    const body = streamFromString([
      'event: error\ndata: {"type":"error","error":{"type":"overloaded_error","message":"Overloaded"}}\n\n',
    ]);
    await consumeAnthropicStream(body, { onError });
    expect(onError).toHaveBeenCalledWith({ type: 'overloaded_error', message: 'Overloaded' });
  });

  it('ignores ping events', async () => {
    const onTextDelta = vi.fn();
    const body = streamFromString(['event: ping\ndata: {}\n\n']);
    await consumeAnthropicStream(body, { onTextDelta });
    expect(onTextDelta).not.toHaveBeenCalled();
  });
});
