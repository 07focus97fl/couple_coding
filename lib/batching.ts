import { CodingMode, PreSegment, DEFAULT_BATCH_SIZE } from "./types";

/**
 * Batching layer: group consecutive PreSegments so several units can be coded in
 * one API call (cost reduction). Because every segmentation strategy funnels
 * through `segment()` into a uniform PreSegment[], grouping is method-agnostic —
 * only the tool schema / parser downstream vary by method.
 */

// Rough words→tokens factor, deliberately on the high side so we cap early
// rather than overrun a call's budget.
const TOKENS_PER_WORD = 1.4;

// Stop adding units to a batch once its target text is estimated to exceed this
// many input tokens. The point is to keep one call from ballooning when units
// are large (long turns, long time windows) — not to micro-optimize. A single
// unit that alone exceeds this still gets its own batch of one.
const BATCH_INPUT_TOKEN_CEILING = 6000;

/**
 * Per-method ceiling on units grouped per call, independent of the token budget.
 * Mechanical-boundary methods (turn, whole-window time) tolerate more; the
 * model-segmented utterance path is the most fragile — it must segment AND keep
 * verbatim substrings across a larger span — so it stays smallest.
 */
function maxUnitsForMode(mode: CodingMode): number {
  if (mode.segmentation === "utterance") return 3;
  if (mode.segmentation === "time" && mode.perSpeaker) return 5;
  return 10; // turn, whole-window time
}

function estUnitTokens(seg: PreSegment): number {
  return Math.ceil(Math.max(1, seg.wordCount) * TOKENS_PER_WORD);
}

/**
 * The effective per-call unit cap for a mode: the requested batchSize clamped by
 * the per-method ceiling. 1 means "no batching" (one unit per call). Used both
 * to chunk segments and to size `computeMaxTokens` for the largest batch.
 */
export function effectiveBatchCap(mode: CodingMode): number {
  const requested = Math.max(1, Math.floor(mode.batchSize ?? DEFAULT_BATCH_SIZE));
  if (requested <= 1) return 1;
  return Math.min(requested, maxUnitsForMode(mode));
}

/**
 * Group consecutive PreSegments into batches. The requested batchSize is an
 * upper bound: each batch also respects the per-method cap and the input-token
 * ceiling, so long units auto-reduce the effective size. batchSize<=1 yields
 * singletons, reproducing the one-call-per-unit behavior exactly.
 */
export function chunkSegments(
  segments: PreSegment[],
  mode: CodingMode,
): PreSegment[][] {
  const cap = effectiveBatchCap(mode);
  if (cap <= 1) return segments.map((s) => [s]);

  const batches: PreSegment[][] = [];
  let cur: PreSegment[] = [];
  let curTokens = 0;

  for (const seg of segments) {
    const t = estUnitTokens(seg);
    // Close the current batch before adding this unit if it's already full or
    // the unit would push it over the token ceiling. The `cur.length > 0` guard
    // ensures an oversized single unit still lands in its own batch of one.
    if (cur.length > 0 && (cur.length >= cap || curTokens + t > BATCH_INPUT_TOKEN_CEILING)) {
      batches.push(cur);
      cur = [];
      curTokens = 0;
    }
    cur.push(seg);
    curTokens += t;
  }
  if (cur.length > 0) batches.push(cur);
  return batches;
}
