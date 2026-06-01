"use client";

import { useMemo } from "react";
import { useSession } from "./CodingSessionContext";
import { segment } from "@/lib/segment";
import type { CodingMode } from "@/lib/types";

export interface RunScope {
  /** Total API calls the run will make — one per segment across selected files. */
  apiCalls: number;
  fileCount: number;
  perFile: { fileName: string; calls: number }[];
}

/**
 * Counts how many API calls a run will make under the current segmentation —
 * one call per segment (turn / utterance-turn / time-window). This is the only
 * cost-relevant quantity we can know for certain before a run, so the UI shows
 * it (and guides users to extrapolate actual cost from a small batch) rather
 * than predicting dollars. Counting only — no prompt building or tokenization.
 */
export function useRunScope(): RunScope {
  const { files, segmentation, outputType, scale, windowSeconds } = useSession();

  // Cheap signature: only file identity + transcript size and the segmentation
  // inputs affect the count, so we recompute only when those change — not on
  // every streamed coded unit while a run is in progress.
  const sig = files
    .filter((f) => f.selected && f.rawTranscript)
    .map((f) => `${f.id}:${f.rawTranscript!.words.length}`)
    .join("|");

  return useMemo(() => {
    const mode: CodingMode = { segmentation, outputType, scale, windowSeconds };
    const selected = files.filter((f) => f.selected && f.rawTranscript);
    const perFile = selected.map((f) => ({
      fileName: f.fileName,
      calls: segment(f.rawTranscript!.words, mode).length,
    }));
    const apiCalls = perFile.reduce((sum, f) => sum + f.calls, 0);
    return { apiCalls, fileCount: selected.length, perFile };
    // `files` is intentionally omitted — `sig` captures the count-relevant parts,
    // so segment() isn't re-run on unrelated state changes during a run.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig, segmentation, outputType, scale, windowSeconds]);
}
