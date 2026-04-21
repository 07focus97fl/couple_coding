import { RawTranscript, SpeakingTurn, TranscriptWord } from "./types";

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
