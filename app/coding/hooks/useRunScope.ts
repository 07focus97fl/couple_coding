"use client";
/**
 * WHAT:    Predicts how many API calls a run will make by re-running the same
 *          segmentation and batching the server will use. Counting only. Also
 *          lists selected files the current mode cannot cut (e.g. time windows
 *          on a CSV conversation) so the Run step can say so before a run.
 * STEP:    Run (the pre-run scope panel in SectionRun).
 * RUNS ON: client
 */

import { useMemo } from "react";
import { useSession } from "./CodingSessionContext";
import { segmentFile } from "@/lib/transcript/segment";
import { isCodeable } from "@/lib/transcript/file-origin";
import { chunkSegments } from "@/lib/coding/batching";
import type { CodingMode } from "@/lib/types";

export interface RunScope {
  /** Total API calls the run will make under the current segmentation and batch
   *  size — one call per batch of units — across selected files. */
  apiCalls: number;
  fileCount: number;
  perFile: { id: string; fileName: string; calls: number }[];
  /** Selected files the current mode cannot segment, with the reason. */
  blocked: { id: string; fileName: string; reason: string }[];
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
    .filter((f) => f.selected && isCodeable(f))
    .map(
      (f) =>
        `${f.id}:${f.turns.length}:${f.rawTranscript?.words.length ?? 0}`,
    )
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
    const selected = files.filter((f) => f.selected && isCodeable(f));
    const perFile: RunScope["perFile"] = [];
    const blocked: RunScope["blocked"] = [];
    for (const f of selected) {
      const r = segmentFile(f, mode);
      if (r.ok) {
        perFile.push({
          id: f.id,
          fileName: f.fileName,
          calls: chunkSegments(r.segments, mode).length,
        });
      } else {
        blocked.push({ id: f.id, fileName: f.fileName, reason: r.error });
      }
    }
    const apiCalls = perFile.reduce((sum, f) => sum + f.calls, 0);
    return { apiCalls, fileCount: perFile.length, perFile, blocked };
    // `files` is intentionally omitted — `sig` captures the count-relevant parts,
    // so segmentFile() isn't re-run on unrelated state changes during a run.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig, segmentation, outputType, scale, windowSeconds, perSpeaker, batchSize]);
}
