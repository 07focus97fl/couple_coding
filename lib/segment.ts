import { CodingMode, PreSegment, TranscriptWord } from "./types";
import { parseTranscript } from "./parse-transcript";

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
    // Reserved extension point. The time-segmentation slice implements
    // lib/segment-time.ts (segmentByTime(words, mode.windowSeconds ?? 30)) and
    // returns it here.
    throw new Error("time segmentation is not yet implemented");
  }
  return turnsToPreSegments(words);
}
