export const runtime = "nodejs";
export const maxDuration = 300;

const ELEVENLABS_URL = "https://api.elevenlabs.io/v1/speech-to-text";

export async function POST(request: Request) {
  const clientKey = request.headers.get("x-elevenlabs-key") || undefined;
  const apiKey = clientKey || process.env.ELEVENLABS_API_KEY;

  if (!apiKey) {
    return new Response(
      JSON.stringify({
        error:
          "No ElevenLabs API key. Add one in Tweaks, or sign in with the dev password.",
      }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  const contentType = request.headers.get("content-type");
  if (!contentType || !contentType.startsWith("multipart/form-data")) {
    return new Response(
      JSON.stringify({ error: "Expected multipart/form-data" }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  let upstream: Response;
  try {
    upstream = await fetch(ELEVENLABS_URL, {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
        "content-type": contentType,
      },
      body: request.body,
      // Node/undici requires duplex: 'half' to use a ReadableStream body.
      duplex: "half",
    } as RequestInit & { duplex: "half" });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Network error";
    return new Response(
      JSON.stringify({ error: `Failed to reach ElevenLabs: ${message}` }),
      { status: 502, headers: { "Content-Type": "application/json" } },
    );
  }

  if (!upstream.ok) {
    const text = await upstream.text().catch(() => "");
    const snippet = text.slice(0, 500) || upstream.statusText;
    const status = upstream.status >= 500 ? 502 : upstream.status;
    return new Response(
      JSON.stringify({
        error: `ElevenLabs returned ${upstream.status}: ${snippet}`,
      }),
      { status, headers: { "Content-Type": "application/json" } },
    );
  }

  const data = await upstream.json();
  return Response.json(data);
}
