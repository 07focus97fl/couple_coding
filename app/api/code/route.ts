/**
 * WHAT:    POST /api/code — codes one transcript. Reads the request, validates it,
 *          builds a run plan, and streams coded units / API logs / progress back
 *          as Server-Sent Events while the engine works.
 * STEP:    Run — server side. Called by the client run hook via fetch("/api/code").
 *          All real work happens in lib/coding/code-segments.ts.
 * RUNS ON: server only
 */
import {
  SpeakingTurn,
  CategoryDefinition,
  Granularity,
  CodingMode,
  PreSegment,
  DEFAULT_CONTEXT_BEFORE,
  DEFAULT_CONTEXT_AFTER,
} from "@/lib/types";
import { getModel } from "@/lib/models";
import { buildRunPlan, codeSegments } from "@/lib/coding/code-segments";
import { formatSseEvent } from "@/lib/coding/sse";

/** The request body the client sends (see README "POST /api/code"). */
interface CodeRequest {
  // Preferred inputs
  segments?: PreSegment[];
  mode?: CodingMode;
  // Legacy inputs (still accepted so the client/server need not deploy in lockstep)
  turns?: SpeakingTurn[];
  granularity?: Granularity;
  model: string;
  categories: CategoryDefinition[];
  systemPrompt: string;
  contextBefore?: number;
  contextAfter?: number;
  /** Legacy single-window field; mapped onto contextBefore when the newer fields are absent. */
  contextWindow?: number;
  apiKey?: string;
  topic?: string;
  /** Reasoning effort for models that support it (OpenAI GPT-5.x). */
  reasoningEffort?: string;
}

/** Adapt legacy SpeakingTurn[] input into the common PreSegment shape. */
function turnsToSegments(turns: SpeakingTurn[]): PreSegment[] {
  return turns.map((t) => ({
    index: t.turnNumber,
    kind: "turn" as const,
    text: t.text,
    startTime: t.startTime,
    endTime: t.endTime,
    wordCount: t.wordCount,
    turnNumber: t.turnNumber,
    speaker: t.speaker,
  }));
}

function badRequest(message: string): Response {
  return new Response(
    JSON.stringify({ error: message }),
    { status: 400, headers: { "Content-Type": "application/json" } }
  );
}

export async function POST(request: Request) {
  const {
    segments: reqSegments,
    mode: reqMode,
    turns,
    granularity,
    model,
    categories,
    systemPrompt: rawPrompt,
    contextBefore: reqContextBefore,
    contextAfter: reqContextAfter,
    contextWindow: legacyContextWindow,
    apiKey: clientKey,
    topic,
    reasoningEffort: reqReasoningEffort,
  } = (await request.json()) as CodeRequest;

  const contextBefore =
    reqContextBefore ?? legacyContextWindow ?? DEFAULT_CONTEXT_BEFORE;
  const contextAfter = reqContextAfter ?? DEFAULT_CONTEXT_AFTER;

  const mode: CodingMode = reqMode ?? {
    segmentation: granularity === "utterance" ? "utterance" : "turn",
    outputType: "categorical",
  };
  const segments: PreSegment[] =
    reqSegments && reqSegments.length > 0
      ? reqSegments
      : turnsToSegments(turns ?? []);

  // ── Validation ──────────────────────────────────────────────────────────

  // Validate the requested model against the catalog and resolve its provider.
  // Unknown or not-yet-released models are rejected here with a clear error
  // instead of failing deep inside a provider SDK.
  const modelDef = getModel(model);
  if (!modelDef || modelDef.comingSoon) {
    return badRequest(`Model "${model}" is not available. Pick a model from the list in the Model step.`);
  }
  const provider = modelDef.provider;
  // Only forward reasoning effort to models that actually expose it.
  const reasoningEffort = modelDef.reasoning ? reqReasoningEffort : undefined;

  // The user brings their own provider key. It is sent per request and used
  // only for this call — never stored on the server.
  const apiKey: string = clientKey || "";
  if (!apiKey || apiKey === "sk-your-key-here") {
    const label =
      provider === "anthropic" ? "Anthropic" : provider === "openai" ? "OpenAI" : "Google";
    return badRequest(`No ${label} API key provided. Add your ${label} key in the Model step.`);
  }

  if (!segments || !Array.isArray(segments) || segments.length === 0) {
    return badRequest("No turns provided");
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

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) =>
        controller.enqueue(encoder.encode(formatSseEvent(event, data)));
      try {
        await codeSegments(plan, (e) => {
          if (e.type === "result") {
            // `codedTurn` duplicates `codedUnit` for older clients.
            send("result", { codedUnit: e.unit, codedTurn: e.unit });
          } else if (e.type === "log") {
            send("log", e.log);
          } else {
            send("progress", { completed: e.completed, total: e.total });
          }
        });
        send("done", {});
        controller.close();
      } catch (err) {
        console.error(`[code ${plan.runId}] run FAILED:`, err);
        const message = err instanceof Error ? err.message : "Unknown error";
        send("error", { message });
        controller.close();
      }
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
