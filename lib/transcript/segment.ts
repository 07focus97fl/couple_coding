/**
 * WHAT:    The segmentation seam: turns a transcript into the PreSegment[] the run
 *          will code, according to the chosen strategy (turn / utterance / time).
 *          Adding a new way to cut a transcript means adding a branch here.
 * STEP:    Run. Called client-side before POSTing to /api/code, and by useRunScope
 *          to predict the call count.
 * RUNS ON: both (pure function)
 */
import {
  CodingMode,
  PreSegment,
  TranscriptWord,
  DEFAULT_WINDOW_SECONDS,
} from "@/lib/types";
import { parseTranscript } from "./parse-transcript";
import { segmentByTime } from "./segment-time";

/** Adapt deterministic speaking turns into the common PreSegment shape. */
function turnsToPreSegments(words: TranscriptWord[]): PreSegment[] {
  return parseTranscript(words).map((t) => ({
    index: t.turnNumber,
    kind: "turn" as const,
    text: t.text,
    startTime: t.startTime,
    endTime: t.endTime,
    wordCount: t.wordCount,
    turnNumber: t.turnNumber,
    speaker: t.speaker,
  }));
}

/**
 * Divide a transcript into pre-segments according to the coding mode. This is
 * the segmentation seam: adding a new way to cut the transcript means adding a
 * branch here plus its segmenter.
 *
 * - "turn" and "utterance" both pre-segment by speaking turn; utterance further
 *   sub-splits inside the model call, so the pre-segments are identical.
 * - "time" yields fixed-duration windows (implemented in the time slice).
 */
export function segment(words: TranscriptWord[], mode: CodingMode): PreSegment[] {
  if (mode.segmentation === "time") {
    return segmentByTime(words, mode.windowSeconds ?? DEFAULT_WINDOW_SECONDS);
  }
  return turnsToPreSegments(words);
}
