/**
 * WHAT:    The Server-Sent Events wire format used between /api/code and the browser:
 *          `event: <name>\ndata: <JSON>\n\n`. One function writes it, one reads it.
 * STEP:    Run — both sides. formatSseEvent is used by app/api/code/route.ts;
 *          readSseEvents is used by the client hook that consumes the stream.
 * RUNS ON: both (no server-only imports)
 */

/** Serialize one event exactly as the route has always emitted it. */
export function formatSseEvent(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

/**
 * Read a streaming response body and yield `{ event, data }` pairs, where `data`
 * is the still-unparsed JSON text. Lines are buffered across network chunks;
 * a partial trailing line is kept until the next chunk completes it.
 */
export async function* readSseEvents(
  body: ReadableStream<Uint8Array>,
): AsyncGenerator<{ event: string; data: string }> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    let eventType = "";
    for (const line of lines) {
      if (line.startsWith("event: ")) {
        eventType = line.slice(7);
      } else if (line.startsWith("data: ")) {
        yield { event: eventType, data: line.slice(6) };
        eventType = "";
      }
    }
  }
}
