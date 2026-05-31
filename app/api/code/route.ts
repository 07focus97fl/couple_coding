import {
  SpeakingTurn,
  CodedUnit,
  CategoryDefinition,
  ApiLog,
  ApiLogParsedUnit,
  Granularity,
  CodingMode,
  PreSegment,
  RatingScale,
  DEFAULT_SCALE,
  DEFAULT_CONTEXT_BEFORE,
  DEFAULT_CONTEXT_AFTER,
} from "@/lib/types";
import { buildSystemPrompt, buildUserMessage } from "./prompts";
import { buildCodingTool, computeMaxTokens } from "@/lib/coding-tool";
import { runStructuredCall } from "@/lib/llm";
import { getModel } from "@/lib/models";

const CONCURRENCY = 5;

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
}

interface TurnModeInput {
  category: string;
  rationale: string;
  subcategory?: string | null;
  alternatives_considered?: string[];
}

interface UtteranceInputEntry {
  text: string;
  category: string;
  rationale: string;
  subcategory?: string | null;
  alternatives_considered?: string[];
}

interface UtteranceModeInput {
  utterances: UtteranceInputEntry[];
}

interface ContinuousWholeInput {
  ratings: Record<string, unknown>;
  rationale: string;
}

interface ContinuousUtteranceEntry {
  text: string;
  ratings: Record<string, unknown>;
  rationale: string;
}

interface ContinuousUtteranceInput {
  utterances: ContinuousUtteranceEntry[];
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

function makeUnitId(seg: PreSegment, utteranceIndex?: number): string {
  const base = seg.kind === "time" ? `W${seg.index}` : `T${seg.turnNumber}`;
  return utteranceIndex !== undefined ? `${base}.U${utteranceIndex}` : base;
}

/** Shared CodingUnit fields for a whole-unit (turn or time window) coding. */
function wholeUnitBase(seg: PreSegment) {
  return {
    turnNumber: seg.kind === "time" ? undefined : seg.turnNumber,
    speaker: seg.kind === "time" ? undefined : seg.speaker,
    speakers: seg.kind === "time" ? seg.speakers : undefined,
    text: seg.text,
    startTime: seg.startTime,
    endTime: seg.endTime,
    wordCount: seg.wordCount,
    kind: seg.kind === "time" ? ("time" as const) : ("turn" as const),
  };
}

/**
 * Validate a model `ratings` object: every dimension must be present and a
 * finite number (else null → retry). In-range is not required — values are
 * clamped to [min,max] so a model returning 8 on a 1–7 scale is kept, not
 * rejected.
 */
function parseRatings(
  raw: unknown,
  dims: string[],
  scale: RatingScale,
): Record<string, number> | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const out: Record<string, number> = {};
  for (const d of dims) {
    const v = r[d];
    if (typeof v !== "number" || !Number.isFinite(v)) return null;
    out[d] = Math.min(scale.max, Math.max(scale.min, v));
  }
  return out;
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

  // Validate the requested model against the catalog and resolve its provider.
  // Unknown or not-yet-released models are rejected here with a clear error
  // instead of failing deep inside a provider SDK.
  const modelDef = getModel(model);
  if (!modelDef || modelDef.comingSoon) {
    return new Response(
      JSON.stringify({ error: `Model "${model}" is not available. Pick a model from the list in the Model step.` }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }
  const provider = modelDef.provider;

  // The user brings their own provider key. It is sent per request and used
  // only for this call — never stored on the server.
  const apiKey: string = clientKey || "";
  if (!apiKey || apiKey === "sk-your-key-here") {
    const label =
      provider === "anthropic" ? "Anthropic" : provider === "openai" ? "OpenAI" : "Google";
    return new Response(
      JSON.stringify({ error: `No ${label} API key provided. Add your ${label} key in the Model step.` }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  if (!segments || !Array.isArray(segments) || segments.length === 0) {
    return new Response(
      JSON.stringify({ error: "No turns provided" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  if (!categories || !Array.isArray(categories) || categories.filter((c) => c.name.trim() !== "").length < 2) {
    return new Response(
      JSON.stringify({ error: "At least 2 categories are required" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  if (!rawPrompt || typeof rawPrompt !== "string" || rawPrompt.trim().length === 0) {
    return new Response(
      JSON.stringify({ error: "System prompt is empty" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const activeGranularity: Granularity =
    mode.segmentation === "utterance" ? "utterance" : "turn";
  const isUtterance = mode.segmentation === "utterance";
  const validCategoryNames = new Set(
    categories.filter((c) => c.name.trim() !== "").map((c) => c.name)
  );
  const isContinuous = mode.outputType === "continuous";
  const scale: RatingScale = mode.scale ?? DEFAULT_SCALE;
  const dimNames = Array.from(validCategoryNames);

  const systemPrompt = buildSystemPrompt(rawPrompt, categories, mode);
  const tool = buildCodingTool(mode, categories);
  const maxTokens = computeMaxTokens(mode, validCategoryNames.size);

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        let completed = 0;
        const total = segments.length;

        async function processUnit(
          seg: PreSegment,
          currentIndex: number
        ): Promise<{ codedUnits: CodedUnit[]; log: ApiLog }> {
          const beforeSegs = segments.slice(
            Math.max(0, currentIndex - contextBefore),
            currentIndex
          );
          const afterSegs = segments.slice(
            currentIndex + 1,
            currentIndex + 1 + contextAfter
          );
          const beforeSegNumbers = beforeSegs.map((s) => s.turnNumber ?? s.index);
          const afterSegNumbers = afterSegs.map((s) => s.turnNumber ?? s.index);

          const userMessage = buildUserMessage(beforeSegs, seg, afterSegs, topic);

          const buildLog = (
            unitIds: string[],
            rawResponse: object,
            parsedUnits: ApiLogParsedUnit[],
            attempt: number
          ): ApiLog => ({
            turnNumber: seg.turnNumber ?? seg.index,
            speaker: seg.speaker ?? (seg.speakers ?? []).join(", "),
            granularity: activeGranularity,
            unitIds,
            contextBefore,
            contextAfter,
            contextBeforeTurnNumbers: beforeSegNumbers,
            contextAfterTurnNumbers: afterSegNumbers,
            model,
            systemPrompt,
            userMessage,
            toolDefinition: tool,
            rawResponse,
            parsedUnits,
            attempt,
            timestamp: new Date().toISOString(),
          });

          const MAX_RETRIES = 2;
          let lastResponse: object | null = null;
          let lastParsedUnits: ApiLogParsedUnit[] = [];
          let lastAttempt = 0;

          for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
            lastAttempt = attempt;
            const { input, raw } = await runStructuredCall({
              provider,
              model,
              apiKey,
              system: systemPrompt,
              user: userMessage,
              tool,
              maxTokens,
            });
            const rawObj = (raw ?? {}) as object;
            lastResponse = rawObj;

            if (isContinuous && !isUtterance) {
              const parsed = input as ContinuousWholeInput | undefined;
              const ratings =
                parsed && typeof parsed.rationale === "string"
                  ? parseRatings(parsed.ratings, dimNames, scale)
                  : null;
              if (ratings) {
                const unit: CodedUnit = {
                  unitId: makeUnitId(seg),
                  ...wholeUnitBase(seg),
                  ratings,
                  rationale: parsed!.rationale,
                };
                lastParsedUnits = [
                  { unitId: unit.unitId, rationale: unit.rationale, ratings },
                ];
                return {
                  codedUnits: [unit],
                  log: buildLog([unit.unitId], rawObj, lastParsedUnits, attempt),
                };
              }
            } else if (isContinuous && isUtterance) {
              const parsed = input as ContinuousUtteranceInput | undefined;
              const list = parsed?.utterances;
              if (
                Array.isArray(list) &&
                list.length > 0 &&
                list.every(
                  (u) =>
                    u &&
                    typeof u.text === "string" &&
                    u.text.trim().length > 0 &&
                    typeof u.rationale === "string" &&
                    parseRatings(u.ratings, dimNames, scale) !== null
                )
              ) {
                const units: CodedUnit[] = list.map((u, i) => {
                  const utteranceIndex = i + 1;
                  return {
                    unitId: makeUnitId(seg, utteranceIndex),
                    turnNumber: seg.turnNumber,
                    utteranceIndex,
                    speaker: seg.speaker,
                    text: u.text,
                    startTime: seg.startTime,
                    endTime: seg.endTime,
                    wordCount: u.text.trim().split(/\s+/).length,
                    ratings: parseRatings(u.ratings, dimNames, scale)!,
                    rationale: u.rationale,
                    kind: "utterance" as const,
                  };
                });
                lastParsedUnits = units.map((u) => ({
                  unitId: u.unitId,
                  rationale: u.rationale,
                  text: u.text,
                  ratings: u.ratings,
                }));
                return {
                  codedUnits: units,
                  log: buildLog(units.map((u) => u.unitId), rawObj, lastParsedUnits, attempt),
                };
              }
            } else if (!isUtterance) {
              const parsed = input as TurnModeInput | undefined;
              if (
                parsed &&
                typeof parsed.category === "string" &&
                typeof parsed.rationale === "string" &&
                validCategoryNames.has(parsed.category)
              ) {
                const subcategory =
                  typeof parsed.subcategory === "string" && parsed.subcategory.trim().length > 0
                    ? parsed.subcategory
                    : null;
                const alternativesConsidered = Array.isArray(parsed.alternatives_considered)
                  ? parsed.alternatives_considered.filter(
                      (s): s is string => typeof s === "string",
                    )
                  : [];
                const unit: CodedUnit = {
                  unitId: makeUnitId(seg),
                  ...wholeUnitBase(seg),
                  category: parsed.category,
                  rationale: parsed.rationale,
                  subcategory,
                  alternativesConsidered,
                };
                lastParsedUnits = [
                  {
                    unitId: unit.unitId,
                    category: parsed.category,
                    rationale: parsed.rationale,
                    subcategory,
                    alternativesConsidered,
                  },
                ];
                return {
                  codedUnits: [unit],
                  log: buildLog([unit.unitId], rawObj, lastParsedUnits, attempt),
                };
              }
            } else {
              const parsed = input as UtteranceModeInput | undefined;
              const list = parsed?.utterances;
              if (
                Array.isArray(list) &&
                list.length > 0 &&
                list.every(
                  (u) =>
                    u &&
                    typeof u.text === "string" &&
                    u.text.trim().length > 0 &&
                    typeof u.category === "string" &&
                    validCategoryNames.has(u.category) &&
                    typeof u.rationale === "string"
                )
              ) {
                const units: CodedUnit[] = list.map((u, i) => {
                  const utteranceIndex = i + 1;
                  const unitId = makeUnitId(seg, utteranceIndex);
                  const subcategory =
                    typeof u.subcategory === "string" && u.subcategory.trim().length > 0
                      ? u.subcategory
                      : null;
                  const alternativesConsidered = Array.isArray(u.alternatives_considered)
                    ? u.alternatives_considered.filter(
                        (s): s is string => typeof s === "string",
                      )
                    : [];
                  return {
                    unitId,
                    turnNumber: seg.turnNumber,
                    utteranceIndex,
                    speaker: seg.speaker,
                    text: u.text,
                    startTime: seg.startTime,
                    endTime: seg.endTime,
                    wordCount: u.text.trim().split(/\s+/).length,
                    category: u.category,
                    rationale: u.rationale,
                    subcategory,
                    alternativesConsidered,
                    kind: "utterance" as const,
                  };
                });
                lastParsedUnits = units.map((u) => ({
                  unitId: u.unitId,
                  category: u.category,
                  rationale: u.rationale,
                  text: u.text,
                  subcategory: u.subcategory,
                  alternativesConsidered: u.alternativesConsidered,
                }));
                return {
                  codedUnits: units,
                  log: buildLog(units.map((u) => u.unitId), rawObj, lastParsedUnits, attempt),
                };
              }
            }
          }

          const errorUnit: CodedUnit = isContinuous
            ? {
                unitId: makeUnitId(seg),
                ...wholeUnitBase(seg),
                ratings: {},
                error: true,
                rationale: "Failed to parse model response",
              }
            : {
                unitId: makeUnitId(seg),
                ...wholeUnitBase(seg),
                category: "error",
                error: true,
                rationale: "Failed to parse model response",
              };
          return {
            codedUnits: [errorUnit],
            log: buildLog([errorUnit.unitId], lastResponse ?? {}, lastParsedUnits, lastAttempt),
          };
        }

        let index = 0;

        async function runNext(): Promise<void> {
          while (index < total) {
            const currentIndex = index++;
            const { codedUnits, log } = await processUnit(
              segments[currentIndex],
              currentIndex
            );

            for (const unit of codedUnits) {
              controller.enqueue(
                encoder.encode(
                  `event: result\ndata: ${JSON.stringify({ codedUnit: unit, codedTurn: unit })}\n\n`
                )
              );
            }

            controller.enqueue(
              encoder.encode(`event: log\ndata: ${JSON.stringify(log)}\n\n`)
            );

            completed++;
            controller.enqueue(
              encoder.encode(
                `event: progress\ndata: ${JSON.stringify({ completed, total })}\n\n`
              )
            );
          }
        }

        const workers = Array.from({ length: Math.min(CONCURRENCY, total) }, () => runNext());
        await Promise.all(workers);

        controller.enqueue(encoder.encode("event: done\ndata: {}\n\n"));
        controller.close();
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        controller.enqueue(
          encoder.encode(`event: error\ndata: ${JSON.stringify({ message })}\n\n`)
        );
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
