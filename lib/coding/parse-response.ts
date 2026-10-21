/**
 * WHAT:    Turns the model's raw tool-call payload for ONE pre-segment into CodedUnit
 *          rows (one branch per coding mode), or null when the payload is invalid for
 *          the mode so the caller can retry. The tone fields of a categorical
 *          turn/utterance entry are read leniently and never cause a retry.
 * STEP:    Run — server side. Called by lib/coding/code-segments.ts after every LLM call.
 * RUNS ON: server only (pure functions, no I/O)
 */
import {
  ApiLogParsedUnit,
  CategoryDefinition,
  CodedUnit,
  CodingMode,
  PreSegment,
  RatingScale,
  DEFAULT_SCALE,
} from "@/lib/types";

// ── What the parser needs to know about the run ──────────────────────────────

/** Derived once per request; every parse call reads from it. */
export interface ParseContext {
  isPerSpeakerTime: boolean;
  isContinuous: boolean;
  isUtterance: boolean;
  /** Category names that are allowed (blank names dropped). */
  validCategoryNames: Set<string>;
  /** Same names as an ordered list; in continuous mode these are the rating dimensions. */
  dimNames: string[];
  scale: RatingScale;
  /** Every speaker seen across all time windows (per-speaker time coding only). */
  roster: string[];
}

export function buildParseContext(
  mode: CodingMode,
  categories: CategoryDefinition[],
  segments: PreSegment[],
): ParseContext {
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

  return { isPerSpeakerTime, isContinuous, isUtterance, validCategoryNames, dimNames, scale, roster };
}

export interface ParseResult {
  units: CodedUnit[];
  parsed: ApiLogParsedUnit[];
}

// ── The shapes the tool call can come back in (one per mode) ─────────────────

/** The tone-only fields of a categorical turn/utterance entry (VTCS [CR7]). */
interface ToneInput {
  ambiguity?: unknown;
  other_reading?: unknown;
  confidence?: unknown;
}

interface TurnModeInput extends ToneInput {
  category: string;
  rationale: string;
  subcategory?: string | null;
  alternatives_considered?: string[];
}

interface UtteranceInputEntry extends ToneInput {
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

// ── Small builders shared by the branches ────────────────────────────────────

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

type ToneFields = Pick<CodedUnit, "ambiguity" | "otherReading" | "confidence">;

/**
 * Read the tone fields leniently: a missing or malformed field is left out and
 * never invalidates the unit (rejecting it would buy a paid retry for a code
 * that is fine). Confidence is clamped to [0,1]; an other_reading that is not a
 * valid code, or repeats the chosen one, becomes null. Returns {} when the
 * model sent none of them (e.g. a scheme whose tool has no such fields).
 */
export function parseTone(
  entry: ToneInput,
  validCategoryNames: Set<string>,
  category: string,
): ToneFields {
  const out: ToneFields = {};
  if (typeof entry.ambiguity === "string" && entry.ambiguity.trim().length > 0) {
    out.ambiguity = entry.ambiguity.trim();
  }
  if ("other_reading" in entry) {
    const r = entry.other_reading;
    out.otherReading =
      typeof r === "string" && validCategoryNames.has(r) && r !== category ? r : null;
  }
  if (typeof entry.confidence === "number" && Number.isFinite(entry.confidence)) {
    out.confidence = Math.min(1, Math.max(0, entry.confidence));
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
 * (lib/transcript/segment-time.ts) renders each line as `${speaker_id}: ...`, so
 * we keep the lines carrying this speaker's prefix and strip it. Falls back to
 * the full window text if nothing matches.
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

// ── One parse function per mode ──────────────────────────────────────────────

/** Time window, one entry per speaker who spoke (categorical or continuous). */
function parsePerSpeakerWindow(ctx: ParseContext, seg: PreSegment, payload: unknown): ParseResult | null {
  const { isContinuous, validCategoryNames, dimNames, scale, roster } = ctx;
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
}

/** Whole turn or whole window, rated on every dimension. */
function parseContinuousWhole(ctx: ParseContext, seg: PreSegment, payload: unknown): ParseResult | null {
  const { dimNames, scale } = ctx;
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
}

/** Turn split into utterances by the model, each rated on every dimension. */
function parseContinuousUtterances(ctx: ParseContext, seg: PreSegment, payload: unknown): ParseResult | null {
  const { dimNames, scale } = ctx;
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
}

/** Whole turn or whole window, one category. */
function parseCategoricalWhole(ctx: ParseContext, seg: PreSegment, payload: unknown): ParseResult | null {
  const { validCategoryNames } = ctx;
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
  const tone = parseTone(parsed, validCategoryNames, parsed.category);
  const unit: CodedUnit = {
    unitId: makeUnitId(seg),
    ...wholeUnitBase(seg),
    category: parsed.category,
    rationale: parsed.rationale,
    subcategory,
    alternativesConsidered,
    ...tone,
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
        ...tone,
      },
    ],
  };
}

/** Turn split into utterances by the model, one category each. */
function parseCategoricalUtterances(ctx: ParseContext, seg: PreSegment, payload: unknown): ParseResult | null {
  const { validCategoryNames } = ctx;
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
      ...parseTone(u, validCategoryNames, u.category),
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
      ambiguity: u.ambiguity,
      otherReading: u.otherReading,
      confidence: u.confidence,
    })),
  };
}

// ── Public entry points ──────────────────────────────────────────────────────

/**
 * Validate + build the coded unit(s) for ONE pre-segment from its tool payload —
 * the top-level tool input when unbatched, or one `units[]` entry when batched.
 * Returns null if the payload is invalid for the mode, so the caller can retry /
 * fall back. Per-speaker time and utterance modes expand to multiple coded units.
 */
export function parseUnitEntry(
  ctx: ParseContext,
  seg: PreSegment,
  payload: unknown,
): ParseResult | null {
  if (ctx.isPerSpeakerTime) return parsePerSpeakerWindow(ctx, seg, payload);
  if (ctx.isContinuous && !ctx.isUtterance) return parseContinuousWhole(ctx, seg, payload);
  if (ctx.isContinuous && ctx.isUtterance) return parseContinuousUtterances(ctx, seg, payload);
  if (!ctx.isUtterance) return parseCategoricalWhole(ctx, seg, payload);
  return parseCategoricalUtterances(ctx, seg, payload);
}

/**
 * The row emitted when a unit could not be coded: the response never parsed
 * after all retries (default reason) or the provider call itself failed.
 */
export function makeErrorUnit(
  ctx: ParseContext,
  seg: PreSegment,
  reason = "Failed to parse model response",
): CodedUnit {
  return ctx.isContinuous
    ? {
        unitId: makeUnitId(seg),
        ...wholeUnitBase(seg),
        ratings: {},
        error: true,
        rationale: reason,
      }
    : {
        unitId: makeUnitId(seg),
        ...wholeUnitBase(seg),
        category: "error",
        error: true,
        rationale: reason,
      };
}
