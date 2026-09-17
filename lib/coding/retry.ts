/**
 * WHAT:    Bounded retry with exponential backoff for provider calls, and the
 *          rules for which errors are worth retrying (rate limits, server and
 *          network errors) versus not (bad key, bad request).
 * STEP:    Run — server side. Used by lib/coding/code-segments.ts.
 * RUNS ON: server only
 */

export interface RetryOptions {
  /** How many times to try again after the first failure. */
  retries: number;
  isRetryable: (err: unknown) => boolean;
  onRetry?: (attempt: number, delayMs: number, err: unknown) => void;
}

const RETRYABLE_STATUSES = new Set([408, 409, 429, 500, 502, 503, 504, 529]);
const MAX_DELAY_MS = 30_000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** The HTTP status carried by an SDK error, if any (Anthropic, OpenAI and Google all expose one). */
export function httpStatusOf(err: unknown): number | undefined {
  if (!err || typeof err !== "object") return undefined;
  const e = err as { status?: unknown; statusCode?: unknown; response?: { status?: unknown } };
  for (const v of [e.status, e.statusCode, e.response?.status]) {
    if (typeof v === "number") return v;
  }
  return undefined;
}

/** 401 / 403: the key is wrong or lacks access; no retry will help. */
export function isAuthError(err: unknown): boolean {
  const s = httpStatusOf(err);
  return s === 401 || s === 403;
}

/**
 * Rate limits, overloads, server errors and connection failures (no status at
 * all) are retried. Anything with a status outside that set is a request the
 * provider rejected and would reject again.
 */
export function isRetryableProviderError(err: unknown): boolean {
  const s = httpStatusOf(err);
  if (s === undefined) return !isAuthError(err);
  return RETRYABLE_STATUSES.has(s);
}

/** A `retry-after` header value in seconds, when the SDK error exposes headers. */
function retryAfterMs(err: unknown): number | undefined {
  if (!err || typeof err !== "object") return undefined;
  const headers = (err as { headers?: unknown }).headers;
  let value: unknown;
  if (headers && typeof (headers as { get?: unknown }).get === "function") {
    value = (headers as { get: (k: string) => unknown }).get("retry-after");
  } else if (headers && typeof headers === "object") {
    value = (headers as Record<string, unknown>)["retry-after"];
  }
  const secs = typeof value === "string" ? Number(value) : undefined;
  return secs !== undefined && Number.isFinite(secs) && secs > 0
    ? Math.min(MAX_DELAY_MS, secs * 1000)
    : undefined;
}

function backoffMs(err: unknown, attempt: number): number {
  const hinted = retryAfterMs(err);
  if (hinted !== undefined) return hinted;
  const base = Math.min(MAX_DELAY_MS, 1000 * 2 ** attempt);
  return Math.round(base * (0.5 + Math.random()));
}

/** Call `fn`, retrying retryable failures up to `retries` times with backoff. */
export async function withRetry<T>(
  fn: () => Promise<T>,
  opts: RetryOptions,
): Promise<T> {
  let attempt = 0;
  for (;;) {
    try {
      return await fn();
    } catch (err) {
      if (attempt >= opts.retries || !opts.isRetryable(err)) throw err;
      const delay = backoffMs(err, attempt);
      attempt++;
      opts.onRetry?.(attempt, delay, err);
      await sleep(delay);
    }
  }
}

export function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
