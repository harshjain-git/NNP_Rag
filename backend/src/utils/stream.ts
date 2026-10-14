/**
 * Stream Utilities for Processing SSE & Chunked Text Responses
 */

/**
 * Asynchronously iterates over lines from a Web ReadableStream.
 * Correctly buffers partial lines across chunk boundaries and multibyte UTF-8 characters.
 */
export async function* iterateLines(
  stream: ReadableStream<Uint8Array>
): AsyncGenerator<string, void, unknown> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        yield line;
      }
    }

    // Flush any remaining buffered characters
    buffer += decoder.decode();
    if (buffer.trim()) {
      yield buffer;
    }
  } finally {
    reader.releaseLock();
  }
}
