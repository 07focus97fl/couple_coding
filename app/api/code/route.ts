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
import {
  buildSystemPrompt,
  buildUserMessage,
  buildBatchUserMessage,
} from "./prompts";
import { buildCodingTool, computeMaxTokens } from "@/lib/coding-tool";
import { chunkSegments, effectiveBatchCap } from "@/lib/batching";
import { runStructuredCall } from "@/lib/llm";
import { getModel } from "@/lib/models";
import {
  normalizeUsage,
  addUsage,
  costFromUsage,
  ZERO_USAGE,
  type NormalizedUsage,
} from "@/lib/usage";

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
  /** Reasoning effort for models that support it (OpenAI GPT-5.x). */
  reasoningEffort?: string;
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

/** One per-speaker entry within a time window (categorical or continuous). */
interface PerSpeakerEntry {
  speaker: string;
  rationale: string;
  category?: string;
  subcategory?: string | null;
  alternatives_considered?: string[];
  ratings?: Record<string, unknown>;
}

interface PerSpeakerInput {
  speakers: PerSpeakerEntry[];
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

/** Per-speaker time unit id, e.g. "W3.speaker_0". Distinct from the combined
 *  whole-window id "W3", so an error fallback never collides. */
function perSpeakerUnitId(seg: PreSegment, speaker: string): string {
  return `W${seg.index}.${speaker}`;
}

/**
 * Pull one speaker's own lines out of a speaker-labeled window. fmtSpeakerLines
 * (lib/segment-time.ts) renders each line as `${speaker_id}: ...`, so we keep
 * the lines carrying this speaker's prefix and strip it. Falls back to the full
 * window text if nothing matches.
 */
function extractSpeakerText(seg: PreSegment, speaker: string): string {
  const own = seg.text
    .split("\n")
    .filter((ln) => ln.startsWith(`${speaker}:`))
    .map((ln) => ln.slice(speaker.length + 1).trim())
    .filter((ln) => ln.length > 0)
    .join(" ");
  return own || seg.text;
}

/** Build a coded row for a speaker who spoke in the window. */
function makePerSpeakerUnit(
  seg: PreSegment,
  e: PerSpeakerEntry,
  isContinuous: boolean,
  scale: RatingScale,
  dimNames: string[],
): CodedUnit {
  const text = extractSpeakerText(seg, e.speaker);
  const base = {
    unitId: perSpeakerUnitId(seg, e.speaker),
    speaker: e.speaker,
    speakers: [e.speaker],
    text,
    startTime: seg.startTime,
    endTime: seg.endTime,
    wordCount: text.trim() ? text.trim().split(/\s+/).length : 0,
    kind: "time" as const,
  };
  if (isContinuous) {
    return {
      ...base,
      ratings: parseRatings(e.ratings, dimNames, scale)!,
      rationale: e.rationale,
    };
  }
  const subcategory =
    typeof e.subcategory === "string" && e.subcategory.trim().length > 0
      ? e.subcategory
      : null;
  const alternativesConsidered = Array.isArray(e.alternatives_considered)
    ? e.alternatives_considered.filter((s): s is string => typeof s === "string")
    : [];
  return {
    ...base,
    category: e.category,
    rationale: e.rationale,
    subcategory,
    alternativesConsidered,
  };
}

/** Synthesize the N/A row for a roster speaker who was silent in the window. */
function makeNaUnit(seg: PreSegment, speaker: string): CodedUnit {
  return {
    unitId: perSpeakerUnitId(seg, speaker),
    speaker,
    speakers: [speaker],
    text: "",
    startTime: seg.startTime,
    endTime: seg.endTime,
    wordCount: 0,
    kind: "time" as const,
    notApplicable: true,
    rationale: "Did not speak in this window.",
  };
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
  const pricing = modelDef.pricing;
  // Only forward reasoning effort to models that actually expose it.
  const reasoningEffort = modelDef.reasoning ? reqReasoningEffort : undefined;

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

  // Per-speaker time coding: derive the global speaker roster (union across all
  // time windows) so every window reports a result for each partner — N/A for
  // any who were silent in that window.
  const isPerSpeakerTime = mode.segmentation === "time" && !!mode.perSpeaker;
  const roster: string[] = Array.from(
    new Set(
      segments
        .filter((s) => s.kind === "time")
        .flatMap((s) => s.speakers ?? []),
    ),
  );

  const systemPrompt = buildSystemPrompt(rawPrompt, categories, mode);
  const tool = buildCodingTool(mode, categories, roster);
  // Batching: group consecutive pre-segments per call (cost reduction). The cap
  // is the requested batchSize clamped per-method; chunkSegments also auto-
  // reduces it for large units. batchCap === 1 ⇒ singleton batches ⇒ the
  // original one-call-per-unit behavior, byte-for-byte.
  const batchCap = effectiveBatchCap(mode);
  const isBatched = batchCap > 1;
  const batches = chunkSegments(segments, mode);
  const maxTokens = computeMaxTokens(
    mode,
    validCategoryNames.size,
    roster.length || 2,
    batchCap,
  );

  // Short id to correlate this run's log lines (one POST = one file).
  const runId = Date.now().toString(36).slice(-5);
  console.log(
    `[code ${runId}] run start: model=${model} provider=${provider} ` +
      `segmentation=${mode.segmentation} output=${mode.outputType} ` +
      `segments=${segments.length} batchSize=${mode.batchSize ?? 1} ` +
      `effectiveCap=${batchCap} batches=${batches.length} maxTokens=${maxTokens} ` +
      `context=${contextBefore}+${contextAfter}`,
  );

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        let completed = 0;
        const total = segments.length;

        type ParseResult = { units: CodedUnit[]; parsed: ApiLogParsedUnit[] };

        /**
         * Validate + build the coded unit(s) for ONE pre-segment from its tool
         * payload — the top-level tool input when unbatched, or one `units[]`
         * entry when batched. Returns null if the payload is invalid for the
         * mode, so the caller can retry / fall back. This is the per-unit logic
         * shared by both paths (it is mode-aware: per-speaker time and utterance
         * expand to multiple coded units).
         */
        function parseUnitEntry(
          seg: PreSegment,
          payload: unknown,
        ): ParseResult | null {
          if (isPerSpeakerTime) {
            const parsed = payload as PerSpeakerInput | undefined;
            const list = parsed?.speakers;
            const windowSpeakers = new Set(seg.speakers ?? []);
            const valid =
              Array.isArray(list) &&
              list.length > 0 &&
              list.every(
                (e) =>
                  e &&
                  typeof e.speaker === "string" &&
                  windowSpeakers.has(e.speaker) &&
                  typeof e.rationale === "string" &&
                  (isContinuous
                    ? parseRatings(e.ratings, dimNames, scale) !== null
                    : typeof e.category === "string" &&
                      validCategoryNames.has(e.category)),
              ) &&
              // Every speaker who spoke in the window must be coded — else
              // retry, rather than silently dropping a speaker's row.
              [...windowSpeakers].every((sp) =>
                list!.some((e) => e?.speaker === sp),
              );
            if (!valid) return null;
            // One row per speaker who spoke (deduped), then synthesized N/A
            // rows for roster speakers absent from this window.
            const seen = new Set<string>();
            const spoke: CodedUnit[] = [];
            for (const e of list!) {
              if (seen.has(e.speaker)) continue;
              seen.add(e.speaker);
              spoke.push(
                makePerSpeakerUnit(seg, e, isContinuous, scale, dimNames),
              );
            }
            const naUnits: CodedUnit[] = roster
              .filter((sp) => !windowSpeakers.has(sp))
              .map((sp) => makeNaUnit(seg, sp));
            const parsedUnits: ApiLogParsedUnit[] = spoke.map((u) => ({
              unitId: u.unitId,
              speaker: u.speaker,
              category: u.category,
              ratings: u.ratings,
              rationale: u.rationale,
              text: u.text,
            }));
            return { units: [...spoke, ...naUnits], parsed: parsedUnits };
          } else if (isContinuous && !isUtterance) {
            const parsed = payload as ContinuousWholeInput | undefined;
            const ratings =
              parsed && typeof parsed.rationale === "string"
                ? parseRatings(parsed.ratings, dimNames, scale)
                : null;
            if (!ratings) return null;
            const unit: CodedUnit = {
              unitId: makeUnitId(seg),
              ...wholeUnitBase(seg),
              ratings,
              rationale: parsed!.rationale,
            };
            return {
              units: [unit],
              parsed: [{ unitId: unit.unitId, rationale: unit.rationale, ratings }],
            };
          } else if (isContinuous && isUtterance) {
            const parsed = payload as ContinuousUtteranceInput | undefined;
            const list = parsed?.utterances;
            if (
              !(
                Array.isArray(list) &&
                list.length > 0 &&
                list.every(
                  (u) =>
                    u &&
                    typeof u.text === "string" &&
                    u.text.trim().length > 0 &&
                    typeof u.rationale === "string" &&
                    parseRatings(u.ratings, dimNames, scale) !== null,
                )
              )
            )
              return null;
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
            return {
              units,
              parsed: units.map((u) => ({
                unitId: u.unitId,
                rationale: u.rationale,
                text: u.text,
                ratings: u.ratings,
              })),
            };
          } else if (!isUtterance) {
            const parsed = payload as TurnModeInput | undefined;
            if (
              !(
                parsed &&
                typeof parsed.category === "string" &&
                typeof parsed.rationale === "string" &&
                validCategoryNames.has(parsed.category)
              )
            )
              return null;
            const subcategory =
              typeof parsed.subcategory === "string" &&
              parsed.subcategory.trim().length > 0
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
            return {
              units: [unit],
              parsed: [
                {
                  unitId: unit.unitId,
                  category: parsed.category,
                  rationale: parsed.rationale,
                  subcategory,
                  alternativesConsidered,
                },
              ],
            };
          } else {
            const parsed = payload as UtteranceModeInput | undefined;
            const list = parsed?.utterances;
            if (
              !(
                Array.isArray(list) &&
                list.length > 0 &&
                list.every(
                  (u) =>
                    u &&
                    typeof u.text === "string" &&
                    u.text.trim().length > 0 &&
                    typeof u.category === "string" &&
                    validCategoryNames.has(u.category) &&
                    typeof u.rationale === "string",
                )
              )
            )
              return null;
            const units: CodedUnit[] = list.map((u, i) => {
              const utteranceIndex = i + 1;
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
                unitId: makeUnitId(seg, utteranceIndex),
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
            return {
              units,
              parsed: units.map((u) => ({
                unitId: u.unitId,
                category: u.category,
                rationale: u.rationale,
                text: u.text,
                subcategory: u.subcategory,
                alternativesConsidered: u.alternativesConsidered,
              })),
            };
          }
        }

        function makeErrorUnit(seg: PreSegment): CodedUnit {
          return isContinuous
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
        }

        /**
         * Code one batch of consecutive pre-segments in a single API call (or a
         * single unit when unbatched). Parses the response per-unit with partial
         * credit, retries the call for any units still missing, and — for a
         * multi-unit batch — falls back to coding each still-missing unit on its
         * own (allowFallback) so batching never yields worse coverage than the
         * one-call-per-unit path. Returns the coded units plus one ApiLog per
         * call made (the batch's own call, plus any fallback calls).
         */
        async function processBatch(
          batchSegs: PreSegment[],
          startIndex: number,
          allowFallback: boolean,
        ): Promise<{ codedUnits: CodedUnit[]; logs: ApiLog[] }> {
          const n = batchSegs.length;
          const beforeSegs = segments.slice(
            Math.max(0, startIndex - contextBefore),
            startIndex,
          );
          const afterSegs = segments.slice(
            startIndex + n,
            startIndex + n + contextAfter,
          );
          const beforeSegNumbers = beforeSegs.map((s) => s.turnNumber ?? s.index);
          const afterSegNumbers = afterSegs.map((s) => s.turnNumber ?? s.index);
          const userMessage = isBatched
            ? buildBatchUserMessage(beforeSegs, batchSegs, afterSegs, topic)
            : buildUserMessage(beforeSegs, batchSegs[0], afterSegs, topic);

          const label = `[${startIndex}..${startIndex + n - 1}]`;
          console.log(
            `[code ${runId}] batch ${label} start: units=${n}` +
              `${allowFallback ? "" : " (fallback)"} userChars=${userMessage.length}`,
          );

          const headSeg = batchSegs[0];
          const buildLog = (
            unitIds: string[],
            rawResponse: object,
            parsedUnits: ApiLogParsedUnit[],
            attempt: number,
            usage: NormalizedUsage,
            attempts: number,
          ): ApiLog => ({
            turnNumber: headSeg.turnNumber ?? headSeg.index,
            speaker: headSeg.speaker ?? (headSeg.speakers ?? []).join(", "),
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
            usage,
            costUsd: costFromUsage(usage, pricing),
            attempts,
          });

          const MAX_RETRIES = 2;
          const filled: (CodedUnit[] | null)[] = new Array(n).fill(null);
          const parsedForLog: ApiLogParsedUnit[] = [];
          // Accumulate usage across EVERY attempt (incl. failed retries, which
          // are still billed) so the logged cost matches what the provider charges.
          let usageAcc: NormalizedUsage = ZERO_USAGE;
          let attemptsMade = 0;
          let lastResponse: object = {};
          let lastAttempt = 0;
          const stillMissing = () => filled.some((f) => f === null);

          for (let attempt = 0; attempt <= MAX_RETRIES && stillMissing(); attempt++) {
            lastAttempt = attempt;
            const callStart = Date.now();
            console.log(
              `[code ${runId}] batch ${label} attempt ${attempt}: ` +
                `calling ${provider}/${model} (maxTokens=${maxTokens})…`,
            );
            let input: unknown;
            let raw: unknown;
            try {
              ({ input, raw } = await runStructuredCall({
                provider,
                model,
                apiKey,
                system: systemPrompt,
                user: userMessage,
                tool,
                maxTokens,
                reasoningEffort,
              }));
            } catch (callErr) {
              console.error(
                `[code ${runId}] batch ${label} attempt ${attempt}: ` +
                  `call THREW after ${Date.now() - callStart}ms:`,
                callErr,
              );
              throw callErr;
            }
            const rawObj = (raw ?? {}) as object;
            lastResponse = rawObj;
            attemptsMade++;
            const callUsage = normalizeUsage(provider, rawObj);
            usageAcc = addUsage(usageAcc, callUsage);
            console.log(
              `[code ${runId}] batch ${label} attempt ${attempt}: ` +
                `returned in ${Date.now() - callStart}ms ` +
                `hasInput=${!!input && typeof input === "object"} ` +
                `usage(in/out/cacheR/cacheW)=${callUsage.inputTokens}/` +
                `${callUsage.outputTokens}/${callUsage.cacheReadTokens}/` +
                `${callUsage.cacheWriteTokens}`,
            );

            if (isBatched) {
              const entries = Array.isArray(
                (input as { units?: unknown } | undefined)?.units,
              )
                ? (input as { units: unknown[] }).units
                : [];
              let pos = 0;
              for (const rawEntry of entries) {
                if (!rawEntry || typeof rawEntry !== "object") continue;
                const entry = rawEntry as Record<string, unknown>;
                // Prefer the echoed unit_index; otherwise take the next free
                // slot by position. Never overwrite an already-filled unit, so
                // partial results from earlier attempts are preserved.
                let idx =
                  typeof entry.unit_index === "number" &&
                  Number.isInteger(entry.unit_index)
                    ? (entry.unit_index as number)
                    : -1;
                if (idx < 0 || idx >= n || filled[idx] !== null) {
                  while (pos < n && filled[pos] !== null) pos++;
                  idx = pos;
                }
                if (idx < 0 || idx >= n || filled[idx] !== null) continue;
                const ok = parseUnitEntry(batchSegs[idx], entry);
                if (ok) {
                  filled[idx] = ok.units;
                  parsedForLog.push(...ok.parsed);
                }
              }
            } else {
              const ok = parseUnitEntry(batchSegs[0], input);
              if (ok) {
                filled[0] = ok.units;
                parsedForLog.push(...ok.parsed);
              }
            }

            console.log(
              `[code ${runId}] batch ${label} attempt ${attempt}: ` +
                `${filled.filter((f) => f !== null).length}/${n} units parsed so far`,
            );
          }

          // Unit ids resolved by THIS batch's own call(s) (partial-credit
          // successes). Fallback-resolved units get their own logs below, so
          // they're excluded here to avoid double-counting ids across logs.
          const ownIds = filled.flatMap((f) => (f ? f.map((u) => u.unitId) : []));

          // Any unit still unparsed after retries: fall back to coding it on its
          // own (a fresh call with full retries) so batching never reduces
          // coverage. A single-unit batch that still fails yields the error unit,
          // attributed to this log (no sub-call was made for it).
          const fallbackLogs: ApiLog[] = [];
          const inlineErrorIds: string[] = [];
          for (let i = 0; i < n; i++) {
            if (filled[i] !== null) continue;
            if (allowFallback && n > 1) {
              const sub = await processBatch([batchSegs[i]], startIndex + i, false);
              filled[i] = sub.codedUnits;
              fallbackLogs.push(...sub.logs);
            } else {
              const errorUnit = makeErrorUnit(batchSegs[i]);
              filled[i] = [errorUnit];
              inlineErrorIds.push(errorUnit.unitId);
            }
          }

          const logs: ApiLog[] = [
            buildLog(
              [...ownIds, ...inlineErrorIds],
              lastResponse,
              parsedForLog,
              lastAttempt,
              usageAcc,
              attemptsMade,
            ),
            ...fallbackLogs,
          ];

          console.log(
            `[code ${runId}] batch ${label} done: ` +
              `resolved=${ownIds.length} errored=${inlineErrorIds.length} ` +
              `fallbackCalls=${fallbackLogs.length} ownCalls=${attemptsMade}`,
          );

          return { codedUnits: filled.flatMap((f) => f ?? []), logs };
        }

        // Each batch's global start index (batches are contiguous and in
        // transcript order), so context windows resolve against `segments`.
        const batchStarts: number[] = [];
        {
          let acc = 0;
          for (const b of batches) {
            batchStarts.push(acc);
            acc += b.length;
          }
        }

        let nextBatch = 0;

        async function runNext(): Promise<void> {
          while (nextBatch < batches.length) {
            const bi = nextBatch++;
            const { codedUnits, logs } = await processBatch(
              batches[bi],
              batchStarts[bi],
              true,
            );

            for (const unit of codedUnits) {
              controller.enqueue(
                encoder.encode(
                  `event: result\ndata: ${JSON.stringify({ codedUnit: unit, codedTurn: unit })}\n\n`
                )
              );
            }

            for (const log of logs) {
              controller.enqueue(
                encoder.encode(`event: log\ndata: ${JSON.stringify(log)}\n\n`)
              );
            }

            // Progress is counted in pre-segments (not batches), so the bar
            // advances the same way regardless of batch size.
            completed += batches[bi].length;
            controller.enqueue(
              encoder.encode(
                `event: progress\ndata: ${JSON.stringify({ completed, total })}\n\n`
              )
            );
          }
        }

        console.log(
          `[code ${runId}] dispatching ${batches.length} batches across ` +
            `${Math.min(CONCURRENCY, batches.length)} workers…`,
        );
        const workers = Array.from(
          { length: Math.min(CONCURRENCY, batches.length) },
          () => runNext(),
        );
        await Promise.all(workers);

        console.log(
          `[code ${runId}] run complete: ${completed}/${total} units coded`,
        );
        controller.enqueue(encoder.encode("event: done\ndata: {}\n\n"));
        controller.close();
      } catch (err) {
        console.error(`[code ${runId}] run FAILED:`, err);
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
