/**
 * WHAT:    The audit export for CSV-origin conversations: the uploaded file's
 *          own columns, verbatim and in order, followed by the model's result
 *          for that row, the frozen run configuration, the price basis and run
 *          totals, the exact usage and cost of the API call that produced the
 *          row, and (optionally) the full prompts and raw response. One output
 *          row per coded unit, so utterance mode fans a turn out into several
 *          rows that repeat the original cells.
 *
 *          Appended column groups, in order:
 *            result   ai_code ai_subcategory ai_rationale ai_alternatives
 *                     [ai_rating_<dim>...] ai_error ai_unit_id
 *                     ai_utterance_index ai_unit_text agree
 *            run      run_id run_started_at model_id model_name provider
 *                     reasoning_effort scheme_id scheme_name segmentation
 *                     output_type batch_size context_before context_after
 *                     prompt_edited categories_edited categories_json [scale_json]
 *            price    price_input_per_1m price_output_per_1m
 *                     price_cache_read_per_1m price_cache_write_per_1m
 *                     run_total_calls run_total_cost_usd
 *            call     call_index call_timestamp call_attempts input_tokens
 *                     output_tokens cache_read_tokens cache_write_tokens
 *                     call_cost_usd context_before_turns context_after_turns
 *            bulky    system_prompt user_message tool_definition_json
 *                     raw_response_json                (only when includeBulky)
 *
 *          `call_cost_usd` is the measured price of that call (provider usage
 *          summed over the call's retries x catalog price), not a prediction.
 *          With batch_size > 1 the same call repeats on every unit of the batch;
 *          `call_index` is the key to sum by. If an original column already
 *          uses one of these names (a re-uploaded export), the appended column
 *          gets a "_2" suffix so no two headers collide.
 * STEP:    Run (export). Called by useCodingRun.exportAuditCsv and the check script.
 * RUNS ON: both (pure functions)
 */
import type {
  ApiLog,
  CodedUnit,
  RunConfigSnapshot,
  TranscriptFile,
} from "@/lib/types";
import { getModel, type ModelPricing } from "@/lib/models";
import { costFromUsage } from "@/lib/usage";
import { humanCodeAt } from "@/lib/transcript/csv-conversations";
import { isCsvOrigin } from "@/lib/transcript/file-origin";
import { sortUnits } from "./sort-units";
import { csvLine } from "./csv-escape";
import { agreeCell } from "./agreement";

export interface AuditCsvInput {
  /** The files to export, in import order. Non-CSV files are ignored. */
  files: TranscriptFile[];
  /** Every log of the run (the in-memory array, never sessionStorage). */
  apiLogs: ApiLog[];
  config: RunConfigSnapshot;
  includeBulky: boolean;
}

export interface LogRef {
  log: ApiLog;
  /** 0-based arrival index of the log among this file's logs. */
  callIndex: number;
}

/**
 * Map every unit id to the API call that produced it. Later logs win, except
 * that a log whose parsed units include the id always beats one that merely
 * lists it (a batch log lists a fallback-resolved id only in its own units).
 */
export function indexLogsByUnit(logs: ApiLog[]): Map<string, LogRef> {
  const latest = new Map<string, LogRef>();
  const definitive = new Map<string, LogRef>();
  logs.forEach((log, callIndex) => {
    const ref = { log, callIndex };
    for (const id of log.unitIds) latest.set(id, ref);
    for (const p of log.parsedUnits) definitive.set(p.unitId, ref);
  });
  for (const [id, ref] of definitive) latest.set(id, ref);
  return latest;
}

function fmtCost(cost: number | null): string {
  return cost === null ? "" : cost.toFixed(8);
}

function logCost(log: ApiLog, pricing: ModelPricing | null): number | null {
  if (typeof log.costUsd === "number") return log.costUsd;
  if (log.usage) return costFromUsage(log.usage, pricing);
  return null;
}

function ratingDims(config: RunConfigSnapshot): string[] {
  return config.outputType === "continuous"
    ? config.categories.map((c) => c.name).filter((n) => n.trim() !== "")
    : [];
}

function resultColumns(config: RunConfigSnapshot): string[] {
  return [
    "ai_code",
    "ai_subcategory",
    "ai_rationale",
    "ai_alternatives",
    ...ratingDims(config).map((d) => `ai_rating_${d}`),
    "ai_error",
    "ai_unit_id",
    "ai_utterance_index",
    "ai_unit_text",
    "agree",
  ];
}

function runColumns(config: RunConfigSnapshot): string[] {
  return [
    "run_id",
    "run_started_at",
    "model_id",
    "model_name",
    "provider",
    "reasoning_effort",
    "scheme_id",
    "scheme_name",
    "segmentation",
    "output_type",
    "batch_size",
    "context_before",
    "context_after",
    "prompt_edited",
    "categories_edited",
    "categories_json",
    ...(config.outputType === "continuous" ? ["scale_json"] : []),
  ];
}

const PRICE_COLUMNS = [
  "price_input_per_1m",
  "price_output_per_1m",
  "price_cache_read_per_1m",
  "price_cache_write_per_1m",
  "run_total_calls",
  "run_total_cost_usd",
];

const CALL_COLUMNS = [
  "call_index",
  "call_timestamp",
  "call_attempts",
  "input_tokens",
  "output_tokens",
  "cache_read_tokens",
  "cache_write_tokens",
  "call_cost_usd",
  "context_before_turns",
  "context_after_turns",
];

const BULKY_COLUMNS = [
  "system_prompt",
  "user_message",
  "tool_definition_json",
  "raw_response_json",
];

/** The appended header names, disambiguated against the original columns. */
export function auditColumns(
  originalColumns: string[],
  config: RunConfigSnapshot,
  includeBulky: boolean,
): string[] {
  const taken = new Set(originalColumns);
  const appended = [
    ...resultColumns(config),
    ...runColumns(config),
    ...PRICE_COLUMNS,
    ...CALL_COLUMNS,
    ...(includeBulky ? BULKY_COLUMNS : []),
  ];
  return appended.map((c) => (taken.has(c) ? `${c}_2` : c));
}

function resultCells(
  unit: CodedUnit,
  humanCode: string,
  config: RunConfigSnapshot,
): string[] {
  return [
    unit.category ?? "",
    unit.subcategory ?? "",
    unit.rationale ?? "",
    (unit.alternativesConsidered ?? []).join("; "),
    ...ratingDims(config).map((d) =>
      unit.ratings?.[d] !== undefined ? String(unit.ratings[d]) : "",
    ),
    unit.error ? "1" : "",
    unit.unitId,
    unit.utteranceIndex !== undefined ? String(unit.utteranceIndex) : "",
    unit.text,
    agreeCell(humanCode, unit),
  ];
}

function runCells(config: RunConfigSnapshot): string[] {
  return [
    config.runId,
    config.startedAt,
    config.modelId,
    config.modelName,
    config.provider,
    config.reasoningEffort,
    config.schemeId ?? "",
    config.schemeName,
    config.segmentation,
    config.outputType,
    String(config.batchSize),
    String(config.contextBefore),
    String(config.contextAfter),
    config.promptDirty ? "1" : "0",
    config.categoriesDirty ? "1" : "0",
    JSON.stringify(config.categories),
    ...(config.outputType === "continuous" ? [JSON.stringify(config.scale)] : []),
  ];
}

function priceCells(
  pricing: ModelPricing | null,
  apiLogs: ApiLog[],
): string[] {
  let total: number | null = 0;
  for (const log of apiLogs) {
    const c = logCost(log, pricing);
    if (c === null) {
      total = null;
      break;
    }
    total += c;
  }
  return [
    pricing ? String(pricing.inputPer1M) : "",
    pricing ? String(pricing.outputPer1M) : "",
    pricing ? String(pricing.cacheReadPer1M ?? pricing.inputPer1M) : "",
    pricing ? String(pricing.cacheWritePer1M ?? pricing.inputPer1M) : "",
    String(apiLogs.length),
    fmtCost(total),
  ];
}

function callCells(ref: LogRef | undefined, pricing: ModelPricing | null): string[] {
  if (!ref) return CALL_COLUMNS.map(() => "");
  const { log, callIndex } = ref;
  const u = log.usage;
  return [
    String(callIndex),
    log.timestamp,
    log.attempts !== undefined ? String(log.attempts) : "",
    u ? String(u.inputTokens) : "",
    u ? String(u.outputTokens) : "",
    u ? String(u.cacheReadTokens) : "",
    u ? String(u.cacheWriteTokens) : "",
    fmtCost(logCost(log, pricing)),
    log.contextBeforeTurnNumbers.join(";"),
    log.contextAfterTurnNumbers.join(";"),
  ];
}

function bulkyCells(ref: LogRef | undefined, includeBulky: boolean): string[] {
  if (!includeBulky) return [];
  if (!ref) return BULKY_COLUMNS.map(() => "");
  const { log } = ref;
  return [
    log.systemPrompt,
    log.userMessage,
    JSON.stringify(log.toolDefinition),
    JSON.stringify(log.rawResponse),
  ];
}

export function generateAuditCsv(input: AuditCsvInput): string {
  const { apiLogs, config, includeBulky } = input;
  const files = input.files.filter(isCsvOrigin);

  // The original header: the union of every file's columns, first-seen order
  // (one uploaded CSV means exactly its header, verbatim).
  const originalColumns: string[] = [];
  for (const f of files) {
    for (const c of f.source.columns) {
      if (!originalColumns.includes(c)) originalColumns.push(c);
    }
  }

  const pricing = getModel(config.modelId)?.pricing ?? null;
  const header = [
    ...originalColumns,
    ...auditColumns(originalColumns, config, includeBulky),
  ];
  const run = runCells(config);
  const price = priceCells(pricing, apiLogs);
  const blankResult = resultColumns(config).map(() => "");
  const blankCall = callCells(undefined, pricing);
  const blankBulky = bulkyCells(undefined, includeBulky);

  const lines: string[] = [csvLine(header)];
  for (const file of files) {
    const byUnit = indexLogsByUnit(apiLogs.filter((l) => l.fileId === file.id));
    const unitsByTurn = new Map<number, CodedUnit[]>();
    for (const u of file.codedUnits) {
      if (u.turnNumber === undefined) continue;
      const list = unitsByTurn.get(u.turnNumber);
      if (list) list.push(u);
      else unitsByTurn.set(u.turnNumber, [u]);
    }
    file.source.rows.forEach((row, i) => {
      const originals = originalColumns.map((c) => row.values[c] ?? "");
      const turnNumber = i + 1;
      const units = sortUnits(unitsByTurn.get(turnNumber) ?? []);
      if (units.length === 0) {
        lines.push(
          csvLine([...originals, ...blankResult, ...run, ...price, ...blankCall, ...blankBulky]),
        );
        return;
      }
      const human = humanCodeAt(file.source, turnNumber);
      for (const unit of units) {
        const ref = byUnit.get(unit.unitId);
        lines.push(
          csvLine([
            ...originals,
            ...resultCells(unit, human, config),
            ...run,
            ...price,
            ...callCells(ref, pricing),
            ...bulkyCells(ref, includeBulky),
          ]),
        );
      }
    });
  }
  return lines.join("\n");
}

/** `<csv base name>_coded_<runId>.csv`, or `audit_coded_<runId>.csv` for several source CSVs. */
export function auditCsvFileName(files: TranscriptFile[], runId: string): string {
  const names = new Set(files.filter(isCsvOrigin).map((f) => f.source.fileName));
  const base =
    names.size === 1
      ? Array.from(names)[0].replace(/\.[^.]+$/, "")
      : "audit";
  return `${base}_coded_${runId}.csv`;
}
