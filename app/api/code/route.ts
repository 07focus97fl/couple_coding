/**
 * WHAT:    POST /api/code — codes one transcript. Reads the request, validates it,
 *          builds a run plan, and streams coded units / API logs / progress back
 *          as Server-Sent Events while the engine works. A client that aborts
 *          the request (Stop button, closed tab) stops the engine from starting
 *          more batches.
 * STEP:    Run — server side. Called by the client run hook via fetch("/api/code").
 *          All real work happens in lib/coding/code-segments.ts.
 * RUNS ON: server only
 */
import {
  CategoryDefinition,
  CodingMode,
  PreSegment,
  DEFAULT_CONTEXT_BEFORE,
  DEFAULT_CONTEXT_AFTER,
} from "@/lib/types";
import { DEFAULT_REASONING_LEVEL, getModel, reasoningLevelsFor } from "@/lib/models";
import { buildRunPlan, codeSegments } from "@/lib/coding/code-segments";
import { formatSseEvent } from "@/lib/coding/sse";

/** Let long runs finish on serverless hosts (mirrors /api/transcribe). */
export const maxDuration = 300;

/** The request body the client sends (see README "POST /api/code"). */
interface CodeRequest {
  /** Pre-cut units, produced client-side by lib/transcript/segment.ts. */
  segments: PreSegment[];
  mode: CodingMode;
  model: string;
  categories: CategoryDefinition[];
  systemPrompt: string;
  contextBefore?: number;
  contextAfter?: number;
  apiKey?: string;
  topic?: string;
  /** Reasoning effort for models that support it (OpenAI GPT-5.x). */
  reasoningEffort?: string;
}

function badRequest(message: string): Response {
  return new Response(
    JSON.stringify({ error: message }),
    { status: 400, headers: { "Content-Type": "application/json" } }
  );
}

export async function POST(request: Request) {
  let body: CodeRequest;
  try {
    body = (await request.json()) as CodeRequest;
  } catch {
    return badRequest("Invalid JSON body");
  }
  const {
    segments,
    mode,
    model,
    categories,
    systemPrompt: rawPrompt,
    contextBefore: reqContextBefore,
    contextAfter: reqContextAfter,
    apiKey: clientKey,
    topic,
    reasoningEffort: reqReasoningEffort,
  } = body;

  const contextBefore = reqContextBefore ?? DEFAULT_CONTEXT_BEFORE;
  const contextAfter = reqContextAfter ?? DEFAULT_CONTEXT_AFTER;

  // ── Validation ──────────────────────────────────────────────────────────

  // Validate the requested model against the catalog and resolve its provider.
  // Unknown or not-yet-released models are rejected here with a clear error
  // instead of failing deep inside a provider SDK.
  const modelDef = getModel(model);
  if (!modelDef || modelDef.comingSoon) {
    return badRequest(`Model "${model}" is not available. Pick a model from the list in the Model step.`);
  }
  const provider = modelDef.provider;
  // Only forward reasoning effort to models that actually expose it, and only a
  // level that model accepts (anything else falls back to the default).
  const levels: string[] = reasoningLevelsFor(modelDef);
  const reasoningEffort = !modelDef.reasoning
    ? undefined
    : reqReasoningEffort && levels.includes(reqReasoningEffort)
    ? reqReasoningEffort
    : DEFAULT_REASONING_LEVEL;

  // The user brings their own provider key. It is sent per request and used
  // only for this call — never stored on the server.
  const apiKey: string = clientKey || "";
  if (!apiKey || apiKey === "sk-your-key-here") {
    const label =
      provider === "anthropic" ? "Anthropic" : provider === "openai" ? "OpenAI" : "Google";
    return badRequest(`No ${label} API key provided. Add your ${label} key in the Model step.`);
  }

  if (!segments || !Array.isArray(segments) || segments.length === 0) {
    return badRequest("No segments provided");
  }

  if (!mode || typeof mode !== "object" || !mode.segmentation || !mode.outputType) {
    return badRequest("No coding mode provided");
  }

  if (!categories || !Array.isArray(categories) || categories.filter((c) => c.name.trim() !== "").length < 2) {
    return badRequest("At least 2 categories are required");
  }

  if (!rawPrompt || typeof rawPrompt !== "string" || rawPrompt.trim().length === 0) {
    return badRequest("System prompt is empty");
  }

  // ── Plan + stream ───────────────────────────────────────────────────────

  const plan = buildRunPlan({
    modelDef,
    apiKey,
    reasoningEffort,
    mode,
    segments,
    categories,
    rawPrompt,
    contextBefore,
    contextAfter,
    topic,
  });

  // Set when the client goes away (Stop button, navigation): the engine polls
  // it before each batch, and nothing is enqueued into a closed stream.
  let cancelled = false;
  request.signal.addEventListener("abort", () => {
    cancelled = true;
  });

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      let closed = false;
      const send = (event: string, data: unknown) => {
        if (closed || cancelled) return;
        try {
          controller.enqueue(encoder.encode(formatSseEvent(event, data)));
        } catch {
          closed = true;
        }
      };
      const close = () => {
        if (closed) return;
        closed = true;
        try {
          controller.close();
        } catch {
          /* already closed by the consumer */
        }
      };
      try {
        await codeSegments(
          plan,
          (e) => {
            if (e.type === "result") {
              send("result", { codedUnit: e.unit });
            } else if (e.type === "log") {
              send("log", e.log);
            } else {
              send("progress", { completed: e.completed, total: e.total });
            }
          },
          () => cancelled,
        );
        send("done", {});
        close();
      } catch (err) {
        console.error(`[code ${plan.runId}] run FAILED:`, err);
        const message = err instanceof Error ? err.message : "Unknown error";
        send("error", { message });
        close();
      }
    },
    cancel() {
      cancelled = true;
      console.log(`[code ${plan.runId}] stream cancelled by client`);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
