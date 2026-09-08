/**
 * WHAT:    Gives model-split utterances exact word-level timings by finding their
 *          text inside the parent turn's words; flags approximateTiming when the
 *          text cannot be matched verbatim.
 * STEP:    Run, client side, as results stream in (useCodingRun).
 * RUNS ON: both (pure functions)
 */
import {
  CodedUnit,
  RawTranscript,
  SegmentationStrategy,
  SpeakingTurn,
  TranscriptWord,
} from "@/lib/types";

export interface AlignmentResult {
  startTime: number;
  endTime: number;
  ok: boolean;
}

export function getTurnWords(
  rawTranscript: RawTranscript,
  turn: SpeakingTurn
): TranscriptWord[] {
  return rawTranscript.words.filter(
    (w) =>
      w.speaker_id === turn.speaker &&
      w.start >= turn.startTime &&
      w.end <= turn.endTime
  );
}

export function alignUtteranceToWords(
  utteranceText: string,
  turnWords: TranscriptWord[]
): AlignmentResult {
  if (!utteranceText || turnWords.length === 0) {
    return { startTime: -1, endTime: -1, ok: false };
  }

  let fullText = "";
  const charToWordIdx: number[] = [];
  for (let i = 0; i < turnWords.length; i++) {
    const w = turnWords[i];
    for (let c = 0; c < w.text.length; c++) charToWordIdx.push(i);
    fullText += w.text;
  }

  const startChar = fullText.indexOf(utteranceText);
  if (startChar === -1) {
    return { startTime: -1, endTime: -1, ok: false };
  }
  const endChar = startChar + utteranceText.length - 1;

  let startWordIdx = charToWordIdx[startChar];
  let endWordIdx = charToWordIdx[endChar];

  while (startWordIdx <= endWordIdx && turnWords[startWordIdx].type !== "word") {
    startWordIdx++;
  }
  while (endWordIdx >= startWordIdx && turnWords[endWordIdx].type !== "word") {
    endWordIdx--;
  }

  if (startWordIdx > endWordIdx) {
    return { startTime: -1, endTime: -1, ok: false };
  }

  return {
    startTime: turnWords[startWordIdx].start,
    endTime: turnWords[endWordIdx].end,
    ok: true,
  };
}

/**
 * Give a streamed utterance unit exact word-level start/end times. Utterance
 * units arrive with their parent turn's timing (the model only returns text);
 * this re-times them by locating the text inside the turn's words. If the text
 * cannot be found verbatim, the unit keeps the turn timing and is flagged
 * `approximateTiming`. Turn and time-window units pass through untouched.
 */
export function alignIncomingUnit(
  unit: CodedUnit,
  rawTranscript: RawTranscript | null,
  turns: SpeakingTurn[],
  segmentation: SegmentationStrategy,
): CodedUnit {
  if (segmentation !== "utterance" || unit.utteranceIndex === undefined) {
    return unit;
  }
  const parentTurn = turns.find((t) => t.turnNumber === unit.turnNumber);
  if (!parentTurn) return unit;
  if (!rawTranscript) return unit;
  const turnWords = getTurnWords(rawTranscript, parentTurn);
  const aligned = alignUtteranceToWords(unit.text, turnWords);
  if (aligned.ok) {
    return { ...unit, startTime: aligned.startTime, endTime: aligned.endTime };
  }
  return { ...unit, approximateTiming: true };
}
