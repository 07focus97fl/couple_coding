"use client";

import { useMemo } from "react";
import { useSession } from "./CodingSessionContext";
import { segment } from "@/lib/segment";
import { chunkSegments } from "@/lib/batching";
import type { CodingMode } from "@/lib/types";

export interface RunScope {
  /** Total API calls the run will make under the current segmentation and batch
   *  size — one call per batch of exchanges — across selected files. */
  apiCalls: number;
  fileCount: number;
  perFile: { fileName: string; calls: number }[];
}

/**
 * Counts how many API calls a run will make under the current segmentation and
 * batch size. Segments (turn / utterance-turn / time-window) are grouped into
 * batches of up to `batchSize` consecutive units (auto-capped per method and by
 * a token budget), so this is the exact number of batches — which equals the
 * segment count when batchSize is 1. It is the only cost-relevant quantity we
 * can know for certain before a run, so the UI shows it (and guides users to
 * extrapolate actual cost from a small batch) rather than predicting dollars.
 * Counting only — no prompt building or tokenization.
 */
export function useRunScope(): RunScope {
  const {
    files,
    segmentation,
    outputType,
    scale,
    windowSeconds,
    perSpeaker,
    batchSize,
  } = useSession();

  // Cheap signature: only file identity + transcript size and the count-relevant
  // mode inputs (segmentation, window size, per-speaker, batch size) affect the
  // result, so we recompute only when those change — not on every streamed coded
  // unit while a run is in progress.
  const sig = files
    .filter((f) => f.selected && f.rawTranscript)
    .map((f) => `${f.id}:${f.rawTranscript!.words.length}`)
    .join("|");

  return useMemo(() => {
    const mode: CodingMode = {
      segmentation,
      outputType,
      scale,
      windowSeconds,
      perSpeaker,
      batchSize,
    };
    const selected = files.filter((f) => f.selected && f.rawTranscript);
    const perFile = selected.map((f) => ({
      fileName: f.fileName,
      calls: chunkSegments(segment(f.rawTranscript!.words, mode), mode).length,
    }));
    const apiCalls = perFile.reduce((sum, f) => sum + f.calls, 0);
    return { apiCalls, fileCount: selected.length, perFile };
    // `files` is intentionally omitted — `sig` captures the count-relevant parts,
    // so segment() isn't re-run on unrelated state changes during a run.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig, segmentation, outputType, scale, windowSeconds, perSpeaker, batchSize]);
}
