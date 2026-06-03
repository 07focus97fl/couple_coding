import type { ModelPricing, ProviderId } from "@/lib/models";

/**
 * Provider-neutral token usage for a single coded segment, summed across all
 * attempts (including failed retries). Providers report usage in different
 * shapes; `normalizeUsage` collapses them into these four buckets, each billed
 * at a distinct rate (see `costFromUsage`).
 */
export interface NormalizedUsage {
  /** Non-cached prompt tokens, billed at inputPer1M. */
  inputTokens: number;
  /** Completion tokens, INCLUDING reasoning/thinking tokens, billed at outputPer1M. */
  outputTokens: number;
  /** Prompt tokens served from cache (cheaper); billed at cacheReadPer1M ?? inputPer1M. */
  cacheReadTokens: number;
  /** Tokens written to cache (Anthropic only); billed at cacheWritePer1M ?? inputPer1M. */
  cacheWriteTokens: number;
}

export const ZERO_USAGE: NormalizedUsage = Object.freeze({
  inputTokens: 0,
  outputTokens: 0,
  cacheReadTokens: 0,
  cacheWriteTokens: 0,
});

export function addUsage(a: NormalizedUsage, b: NormalizedUsage): NormalizedUsage {
  return {
    inputTokens: a.inputTokens + b.inputTokens,
    outputTokens: a.outputTokens + b.outputTokens,
    cacheReadTokens: a.cacheReadTokens + b.cacheReadTokens,
    cacheWriteTokens: a.cacheWriteTokens + b.cacheWriteTokens,
  };
}

/** Coerce an unknown field to a finite, non-negative token count (else 0). */
function num(v: unknown): number {
  return typeof v === "number" && Number.isFinite(v) && v > 0 ? v : 0;
}

/**
 * Translate a raw provider response into `NormalizedUsage`. Every field access
 * is guarded so a missing/partial/empty response yields ZERO_USAGE rather than
 * throwing. Notes per provider:
 * - Anthropic reports `input_tokens` already EXCLUDING cache, with cache buckets
 *   reported separately, so no subtraction is needed.
 * - OpenAI's `prompt_tokens`/`completion_tokens` are TOTALS (incl. cached prompt
 *   and reasoning output respectively), so cached is subtracted from input.
 * - Google's `promptTokenCount` is a TOTAL incl. cached, and `candidatesTokenCount`
 *   EXCLUDES thinking, so thoughts are added back into output.
 */
export function normalizeUsage(provider: ProviderId, raw: unknown): NormalizedUsage {
  if (!raw || typeof raw !== "object") return ZERO_USAGE;
  const r = raw as Record<string, unknown>;

  if (provider === "google") {
    const m = r.usageMetadata as Record<string, unknown> | undefined;
    if (!m || typeof m !== "object") return ZERO_USAGE;
    const cacheRead = num(m.cachedContentTokenCount);
    return {
      inputTokens: Math.max(0, num(m.promptTokenCount) - cacheRead),
      outputTokens: num(m.candidatesTokenCount) + num(m.thoughtsTokenCount),
      cacheReadTokens: cacheRead,
      cacheWriteTokens: 0,
    };
  }

  const u = r.usage as Record<string, unknown> | undefined;
  if (!u || typeof u !== "object") return ZERO_USAGE;

  if (provider === "openai") {
    // Responses API (reasoning models) reports input_tokens/output_tokens with
    // input_tokens_details.cached_tokens; Chat Completions reports
    // prompt_tokens/completion_tokens with prompt_tokens_details.cached_tokens.
    // In both, the output total already includes reasoning tokens. Support both.
    if (typeof u.input_tokens === "number") {
      const details = u.input_tokens_details as Record<string, unknown> | undefined;
      const cacheRead = num(details?.cached_tokens);
      return {
        inputTokens: Math.max(0, num(u.input_tokens) - cacheRead),
        outputTokens: num(u.output_tokens),
        cacheReadTokens: cacheRead,
        cacheWriteTokens: 0,
      };
    }
    const details = u.prompt_tokens_details as Record<string, unknown> | undefined;
    const cacheRead = num(details?.cached_tokens);
    return {
      inputTokens: Math.max(0, num(u.prompt_tokens) - cacheRead),
      outputTokens: num(u.completion_tokens),
      cacheReadTokens: cacheRead,
      cacheWriteTokens: 0,
    };
  }

  // anthropic (default)
  return {
    inputTokens: num(u.input_tokens),
    outputTokens: num(u.output_tokens),
    cacheReadTokens: num(u.cache_read_input_tokens),
    cacheWriteTokens: num(u.cache_creation_input_tokens),
  };
}

/**
 * Exact USD cost from normalized usage × catalog rates. Returns null when the
 * model has no pricing (callers render "—"). Cache buckets fall back to the
 * plain input rate when no discounted rate is set in the catalog, so the result
 * is at worst slightly conservative, never under-reported.
 */
export function costFromUsage(
  u: NormalizedUsage,
  pricing: ModelPricing | null,
): number | null {
  if (!pricing) return null;
  const cacheRead = pricing.cacheReadPer1M ?? pricing.inputPer1M;
  const cacheWrite = pricing.cacheWritePer1M ?? pricing.inputPer1M;
  return (
    (u.inputTokens * pricing.inputPer1M +
      u.outputTokens * pricing.outputPer1M +
      u.cacheReadTokens * cacheRead +
      u.cacheWriteTokens * cacheWrite) /
    1_000_000
  );
}

/** Format a USD cost for display. null (no pricing) → "—". */
export function formatCost(usd: number | null): string {
  if (usd === null) return "—";
  if (usd <= 0) return "$0.000";
  if (usd < 0.01) return `$${usd.toFixed(4)}`;
  if (usd < 1) return `$${usd.toFixed(3)}`;
  return `$${usd.toFixed(2)}`;
}
