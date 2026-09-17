/**
 * WHAT:    The segmentation seam: turns a transcript into the PreSegment[] the run
 *          will code, according to the chosen strategy (turn / utterance / time).
 *          `segmentFile` is the one entry point for a TranscriptFile of either
 *          origin (word-level JSON or CSV rows). Adding a new way to cut a
 *          transcript means adding a branch here.
 * STEP:    Run. Called client-side before POSTing to /api/code, and by useRunScope
 *          to predict the call count.
 * RUNS ON: both (pure function)
 */
import {
  CodingMode,
  PreSegment,
  SpeakingTurn,
  TranscriptFile,
  TranscriptWord,
  DEFAULT_WINDOW_SECONDS,
} from "@/lib/types";
import { parseTranscript } from "./parse-transcript";
import { segmentByTime } from "./segment-time";

/** Adapt deterministic speaking turns into the common PreSegment shape. */
export function segmentTurns(turns: SpeakingTurn[]): PreSegment[] {
  return turns.map((t) => ({
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
 * Divide a word-level transcript into pre-segments according to the coding
 * mode.
 *
 * - "turn" and "utterance" both pre-segment by speaking turn; utterance further
 *   sub-splits inside the model call, so the pre-segments are identical.
 * - "time" yields fixed-duration windows (implemented in the time slice).
 */
export function segment(words: TranscriptWord[], mode: CodingMode): PreSegment[] {
  if (mode.segmentation === "time") {
    return segmentByTime(words, mode.windowSeconds ?? DEFAULT_WINDOW_SECONDS);
  }
  return segmentTurns(parseTranscript(words));
}

export type SegmentFileResult =
  | { ok: true; turns: SpeakingTurn[]; segments: PreSegment[] }
  | { ok: false; error: string };

/**
 * Segment one uploaded file, whatever its origin. This is also where the human
 * code of a CSV-origin file is kept away from the model: pre-segments are built
 * from `turns` (speaker + text only); `source.rows`, which hold the human code,
 * are never read here.
 *
 * Time windows need word timings, so a CSV-origin file (no `rawTranscript`)
 * cannot be cut that way and returns an error instead of a wrong cut.
 */
export function segmentFile(
  file: Pick<TranscriptFile, "rawTranscript" | "turns" | "source">,
  mode: CodingMode,
): SegmentFileResult {
  if (mode.segmentation === "time") {
    if (!file.rawTranscript) {
      return {
        ok: false,
        error:
          "Time-window segmentation needs word-level timings; this conversation came from a CSV. Choose turn or utterance.",
      };
    }
    const turns =
      file.turns.length > 0 ? file.turns : parseTranscript(file.rawTranscript.words);
    return {
      ok: true,
      turns,
      segments: segmentByTime(
        file.rawTranscript.words,
        mode.windowSeconds ?? DEFAULT_WINDOW_SECONDS,
      ),
    };
  }
  const turns =
    file.turns.length > 0
      ? file.turns
      : file.rawTranscript
      ? parseTranscript(file.rawTranscript.words)
      : [];
  if (turns.length === 0) return { ok: false, error: "No turns to code." };
  return { ok: true, turns, segments: segmentTurns(turns) };
}
