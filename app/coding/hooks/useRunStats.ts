"use client";

import { useEffect, useMemo, useState } from "react";
import { ApiLog } from "@/lib/types";
import { getModel } from "@/lib/models";

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
  hasUsage: boolean;
}

function extractUsage(
  log: ApiLog,
): { input: number; output: number } | null {
  const raw = log.rawResponse as
    | { usage?: { input_tokens?: number; output_tokens?: number } }
    | undefined;
  if (!raw || typeof raw !== "object") return null;
  const usage = raw.usage;
  if (!usage) return null;
  return {
    input: typeof usage.input_tokens === "number" ? usage.input_tokens : 0,
    output: typeof usage.output_tokens === "number" ? usage.output_tokens : 0,
  };
}

export function useRunStats(
  apiLogs: ApiLog[],
  runStartedAt: number | null,
  total: number,
  completed: number,
  modelId: string,
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
        ratePerMin = (slice.length - 1) / (spanMs / 60_000);
      }
    } else if (elapsedMs > 0 && completed > 0) {
      ratePerMin = completed / (elapsedMs / 60_000);
    }

    const etaMs =
      ratePerMin > 0 && remaining > 0
        ? (remaining / ratePerMin) * 60_000
        : null;

    let inputTokens = 0;
    let outputTokens = 0;
    let hasUsage = false;
    for (const log of apiLogs) {
      const u = extractUsage(log);
      if (u) {
        hasUsage = true;
        inputTokens += u.input;
        outputTokens += u.output;
      }
    }

    const model = getModel(modelId);
    let costUsd = 0;
    if (model?.pricing && hasUsage) {
      costUsd =
        (inputTokens * model.pricing.inputPer1M +
          outputTokens * model.pricing.outputPer1M) /
        1_000_000;
    }

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
      hasUsage,
    };
  }, [apiLogs, now, runStartedAt, total, completed, modelId]);
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

export function formatCost(usd: number): string {
  if (usd <= 0) return "$0.000";
  if (usd < 0.01) return `$${usd.toFixed(4)}`;
  if (usd < 1) return `$${usd.toFixed(3)}`;
  return `$${usd.toFixed(2)}`;
}

export function formatRate(perMin: number): string {
  if (perMin <= 0) return "—";
  return `${Math.round(perMin)}/min`;
}
