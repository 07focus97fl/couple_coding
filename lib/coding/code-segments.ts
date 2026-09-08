/**
 * WHAT:    The coding engine for one transcript: turns a validated request into a
 *          RunPlan (prompt, tool schema, batches, token budget), then codes every
 *          batch with retries, partial credit and per-unit fallback, across a small
 *          pool of concurrent workers. Emits results/logs/progress through a callback
 *          so it knows nothing about HTTP or streams.
 * STEP:    Run — server side. Called by app/api/code/route.ts.
 * RUNS ON: server only (calls the LLM providers through lib/llm)
 */
import {
  ApiLog,
  ApiLogParsedUnit,
  CategoryDefinition,
  CodedUnit,
  CodingMode,
  Granularity,
  PreSegment,
} from "@/lib/types";
import {
  buildSystemPrompt,
  buildUserMessage,
  buildBatchUserMessage,
} from "./build-messages";
import { buildCodingTool, computeMaxTokens } from "./build-tool";
import { chunkSegments, effectiveBatchCap } from "./batching";
import { runStructuredCall, type LlmTool } from "@/lib/llm";
import type { ModelDef, ModelPricing, ProviderId } from "@/lib/models";
import {
  normalizeUsage,
  addUsage,
  costFromUsage,
  ZERO_USAGE,
  type NormalizedUsage,
} from "@/lib/usage";
import {
  buildParseContext,
  makeErrorUnit,
  parseUnitEntry,
  type ParseContext,
} from "./parse-response";

/** How many batches are coded at the same time. */
const CONCURRENCY = 5;

// ── The plan: everything decided once per request ────────────────────────────

/** The already-validated request, as the route hands it over. */
export interface RunPlanInput {
  modelDef: ModelDef;
  apiKey: string;
  /** Only set for models that expose a reasoning effort. */
  reasoningEffort?: string;
  mode: CodingMode;
  segments: PreSegment[];
  categories: CategoryDefinition[];
  /** The user's (possibly edited) system prompt, before the category block is appended. */
  rawPrompt: string;
  contextBefore: number;
  contextAfter: number;
  topic?: string;
}

export interface RunPlan {
  /** Short id that prefixes this run's server log lines. */
  runId: string;
  provider: ProviderId;
  model: string;
  apiKey: string;
  reasoningEffort?: string;
  pricing: ModelPricing | null;
  mode: CodingMode;
  segments: PreSegment[];
  /** Consecutive segments grouped per API call (singletons when batchSize is 1). */
  batches: PreSegment[][];
  isBatched: boolean;
  maxTokens: number;
  contextBefore: number;
  contextAfter: number;
  topic?: string;
  /** The final system prompt actually sent (user prompt + category block). */
  systemPrompt: string;
  /** The forced tool the model must call. */
  tool: LlmTool;
  /** Legacy turn/utterance view of the segmentation, stamped on each ApiLog. */
  activeGranularity: Granularity;
  parse: ParseContext;
}

export function buildRunPlan(input: RunPlanInput): RunPlan {
  const { modelDef, mode, segments, categories, contextBefore, contextAfter } = input;
  const model = modelDef.id;
  const provider = modelDef.provider;
  const pricing = modelDef.pricing;

  const activeGranularity: Granularity =
    mode.segmentation === "utterance" ? "utterance" : "turn";
  const parse = buildParseContext(mode, categories, segments);

  const systemPrompt = buildSystemPrompt(input.rawPrompt, categories, mode);
  const tool = buildCodingTool(mode, categories, parse.roster);
  // Batching: group consecutive pre-segments per call (cost reduction). The cap
  // is the requested batchSize clamped per-method; chunkSegments also auto-
  // reduces it for large units. batchCap === 1 ⇒ singleton batches ⇒ the
  // original one-call-per-unit behavior, byte-for-byte.
  const batchCap = effectiveBatchCap(mode);
  const isBatched = batchCap > 1;
  const batches = chunkSegments(segments, mode);
  const maxTokens = computeMaxTokens(
    mode,
    parse.validCategoryNames.size,
    parse.roster.length || 2,
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

  return {
    runId,
    provider,
    model,
    apiKey: input.apiKey,
    reasoningEffort: input.reasoningEffort,
    pricing,
    mode,
    segments,
    batches,
    isBatched,
    maxTokens,
    contextBefore,
    contextAfter,
    topic: input.topic,
    systemPrompt,
    tool,
    activeGranularity,
    parse,
  };
}

// ── The run loop ─────────────────────────────────────────────────────────────

export type RunEvent =
  | { type: "result"; unit: CodedUnit }
  | { type: "log"; log: ApiLog }
  | { type: "progress"; completed: number; total: number };

/**
 * Code every batch in the plan. Batches are pulled from a shared cursor by
 * CONCURRENCY workers, so up to five API calls are in flight at once. Progress
 * is counted in pre-segments (not batches) so the bar advances the same way
 * regardless of batch size. Throws if a provider call throws.
 */
export async function codeSegments(
  plan: RunPlan,
  emit: (e: RunEvent) => void,
): Promise<void> {
  let completed = 0;
  const total = plan.segments.length;

  // Each batch's global start index (batches are contiguous and in
  // transcript order), so context windows resolve against `segments`.
  const batchStarts: number[] = [];
  {
    let acc = 0;
    for (const b of plan.batches) {
      batchStarts.push(acc);
      acc += b.length;
    }
  }

  let nextBatch = 0;

  async function runNext(): Promise<void> {
    while (nextBatch < plan.batches.length) {
      const bi = nextBatch++;
      const { codedUnits, logs } = await processBatch(
        plan,
        plan.batches[bi],
        batchStarts[bi],
        true,
      );

      for (const unit of codedUnits) emit({ type: "result", unit });
      for (const log of logs) emit({ type: "log", log });

      completed += plan.batches[bi].length;
      emit({ type: "progress", completed, total });
    }
  }

  console.log(
    `[code ${plan.runId}] dispatching ${plan.batches.length} batches across ` +
      `${Math.min(CONCURRENCY, plan.batches.length)} workers…`,
  );
  const workers = Array.from(
    { length: Math.min(CONCURRENCY, plan.batches.length) },
    () => runNext(),
  );
  await Promise.all(workers);

  console.log(
    `[code ${plan.runId}] run complete: ${completed}/${total} units coded`,
  );
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
  plan: RunPlan,
  batchSegs: PreSegment[],
  startIndex: number,
  allowFallback: boolean,
): Promise<{ codedUnits: CodedUnit[]; logs: ApiLog[] }> {
  const { runId, segments, contextBefore, contextAfter, isBatched, topic, parse } = plan;
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
    granularity: plan.activeGranularity,
    unitIds,
    contextBefore,
    contextAfter,
    contextBeforeTurnNumbers: beforeSegNumbers,
    contextAfterTurnNumbers: afterSegNumbers,
    model: plan.model,
    systemPrompt: plan.systemPrompt,
    userMessage,
    toolDefinition: plan.tool,
    rawResponse,
    parsedUnits,
    attempt,
    timestamp: new Date().toISOString(),
    usage,
    costUsd: costFromUsage(usage, plan.pricing),
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
        `calling ${plan.provider}/${plan.model} (maxTokens=${plan.maxTokens})…`,
    );
    let input: unknown;
    let raw: unknown;
    try {
      ({ input, raw } = await runStructuredCall({
        provider: plan.provider,
        model: plan.model,
        apiKey: plan.apiKey,
        system: plan.systemPrompt,
        user: userMessage,
        tool: plan.tool,
        maxTokens: plan.maxTokens,
        reasoningEffort: plan.reasoningEffort,
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
    const callUsage = normalizeUsage(plan.provider, rawObj);
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
        const ok = parseUnitEntry(parse, batchSegs[idx], entry);
        if (ok) {
          filled[idx] = ok.units;
          parsedForLog.push(...ok.parsed);
        }
      }
    } else {
      const ok = parseUnitEntry(parse, batchSegs[0], input);
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
      const sub = await processBatch(plan, [batchSegs[i]], startIndex + i, false);
      filled[i] = sub.codedUnits;
      fallbackLogs.push(...sub.logs);
    } else {
      const errorUnit = makeErrorUnit(parse, batchSegs[i]);
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
