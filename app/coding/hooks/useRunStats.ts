"use client";

import { useEffect, useMemo, useState } from "react";
import { ApiLog } from "@/lib/types";
import { getModel } from "@/lib/models";
import {
  normalizeUsage,
  costFromUsage,
  type NormalizedUsage,
} from "@/lib/usage";

export interface RunStats {
  elapsedMs: number;
  completed: number;
  total: number;
  remaining: number;
  ratePerMin: number;
  etaMs: number | null;
  costUsd: number;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  hasUsage: boolean;
}

/**
 * Per-log usage + cost, provider-agnostic and retry-inclusive. New logs carry a
 * pre-computed `usage`/`costUsd` (stamped server-side across all attempts). Older
 * logs persisted before that change are normalized on the fly from the stored
 * raw response, so historical OpenAI/Google logs get correct costs too.
 */
function resolveLog(log: ApiLog): { usage: NormalizedUsage; cost: number | null } {
  const model = getModel(log.model);
  const pricing = model?.pricing ?? null;
  if (log.usage) {
    return { usage: log.usage, cost: log.costUsd ?? costFromUsage(log.usage, pricing) };
  }
  const usage = normalizeUsage(model?.provider ?? "anthropic", log.rawResponse);
  return { usage, cost: costFromUsage(usage, pricing) };
}

export interface UsageTotals {
  costUsd: number;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  hasUsage: boolean;
  /** Number of logged API calls (a single call may cover several exchanges when batching). */
  callCount: number;
}

/** Sum normalized usage + cost across a set of logs (one log = one API call). */
export function sumLogUsage(logs: ApiLog[]): UsageTotals {
  let inputTokens = 0;
  let outputTokens = 0;
  let cacheReadTokens = 0;
  let cacheWriteTokens = 0;
  let costUsd = 0;
  let hasUsage = false;
  for (const log of logs) {
    const { usage, cost } = resolveLog(log);
    const totalTokens =
      usage.inputTokens +
      usage.outputTokens +
      usage.cacheReadTokens +
      usage.cacheWriteTokens;
    if (totalTokens > 0) {
      hasUsage = true;
      inputTokens += usage.inputTokens;
      outputTokens += usage.outputTokens;
      cacheReadTokens += usage.cacheReadTokens;
      cacheWriteTokens += usage.cacheWriteTokens;
      if (cost !== null) costUsd += cost;
    }
  }
  return {
    costUsd,
    inputTokens,
    outputTokens,
    cacheReadTokens,
    cacheWriteTokens,
    hasUsage,
    callCount: logs.length,
  };
}

export function useRunStats(
  apiLogs: ApiLog[],
  runStartedAt: number | null,
  total: number,
  completed: number,
  isRunning: boolean,
): RunStats {
  const [now, setNow] = useState<number>(() => Date.now());

  useEffect(() => {
    if (!isRunning || !runStartedAt) return;
    const handle = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(handle);
  }, [isRunning, runStartedAt]);

  return useMemo(() => {
    const elapsedMs = runStartedAt ? Math.max(0, now - runStartedAt) : 0;
    const remaining = Math.max(0, total - completed);

    const N = Math.min(20, apiLogs.length);
    let ratePerMin = 0;
    if (N >= 2) {
      const slice = apiLogs.slice(-N);
      const start = new Date(slice[0].timestamp).getTime();
      const end = new Date(slice[slice.length - 1].timestamp).getTime();
      const spanMs = end - start;
      if (spanMs > 0) {
        const callsPerMin = (slice.length - 1) / (spanMs / 60_000);
        // Logs count API calls; with batching a call covers several segments, so
        // scale by the running average segments-per-call to express the rate in
        // segments/min — the unit `remaining`/`completed` use. (Equals
        // callsPerMin when batchSize is 1.)
        const segPerCall = apiLogs.length > 0 ? completed / apiLogs.length : 1;
        ratePerMin = callsPerMin * segPerCall;
      }
    } else if (elapsedMs > 0 && completed > 0) {
      ratePerMin = completed / (elapsedMs / 60_000);
    }

    const etaMs =
      ratePerMin > 0 && remaining > 0
        ? (remaining / ratePerMin) * 60_000
        : null;

    const {
      costUsd,
      inputTokens,
      outputTokens,
      cacheReadTokens,
      cacheWriteTokens,
      hasUsage,
    } = sumLogUsage(apiLogs);

    return {
      elapsedMs,
      completed,
      total,
      remaining,
      ratePerMin,
      etaMs,
      costUsd,
      inputTokens,
      outputTokens,
      cacheReadTokens,
      cacheWriteTokens,
      hasUsage,
    };
  }, [apiLogs, now, runStartedAt, total, completed]);
}

export function formatElapsed(ms: number): string {
  if (ms <= 0) return "0s";
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(1)}s`;
  const m = Math.floor(s / 60);
  const rem = Math.floor(s % 60);
  return `${m}m ${rem}s`;
}

export function formatEta(ms: number | null): string {
  if (ms === null) return "—";
  return `~${formatElapsed(ms)}`;
}

export { formatCost } from "@/lib/usage";

export function formatRate(perMin: number): string {
  if (perMin <= 0) return "—";
  return `${Math.round(perMin)}/min`;
}
