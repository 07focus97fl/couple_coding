/**
 * WHAT:    Two small questions about a TranscriptFile: did it come from a CSV,
 *          and can it be coded at all (a transcript or CSV rows are present)?
 * STEP:    Shared by Upload, Scheme and Run.
 * RUNS ON: both (pure functions)
 */
import type { CsvSource, TranscriptFile } from "@/lib/types";

export function isCsvOrigin(
  f: TranscriptFile,
): f is TranscriptFile & { source: CsvSource } {
  return f.source !== undefined;
}

/** True when the file has something to code: word-level JSON or CSV rows. */
export function isCodeable(f: TranscriptFile): boolean {
  return f.rawTranscript !== null || f.source !== undefined;
}
