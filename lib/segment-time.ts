import { PreSegment, TranscriptWord } from "./types";

/**
 * Render a window's tokens as speaker-labeled lines, e.g.
 *   speaker_0: I feel like you're not listening.
 *   speaker_1: I am, I just disagree.
 * A new line starts whenever the speaking word changes speaker; spacing tokens
 * ride along with the current line so original spacing is preserved.
 */
function fmtSpeakerLines(toks: TranscriptWord[]): string {
  const lines: string[] = [];
  let curSpeaker: string | null = null;
  let buf: string[] = [];
  const flush = () => {
    if (curSpeaker !== null) {
      const text = buf.join("").trim();
      if (text) lines.push(`${curSpeaker}: ${text}`);
    }
    buf = [];
  };
  for (const t of toks) {
    if (t.type === "word" && t.speaker_id !== curSpeaker) {
      flush();
      curSpeaker = t.speaker_id;
    }
    buf.push(t.text);
  }
  flush();
  return lines.join("\n");
}

/**
 * Divide a transcript into fixed-duration windows. Each window may contain both
 * speakers (its text is speaker-labeled). Window boundaries are measured from
 * the first word's start time; silent windows produce no segment and the
 * remaining windows are re-indexed contiguously. Times come straight from word
 * boundaries, so no substring re-alignment is needed downstream.
 */
export function segmentByTime(
  words: TranscriptWord[],
  windowSeconds: number,
): PreSegment[] {
  const w = windowSeconds > 0 ? windowSeconds : 30;
  const wordTokens = words.filter((x) => x.type === "word");
  if (wordTokens.length === 0) return [];
  const t0 = wordTokens[0].start;

  // Bucket every token by the most recent word's window index, so trailing
  // spacing tokens stay with their word. Tokens before the first word are
  // dropped (curBucket < 0).
  const buckets = new Map<number, TranscriptWord[]>();
  let curBucket = -1;
  for (const tok of words) {
    if (tok.type === "word") curBucket = Math.floor((tok.start - t0) / w);
    if (curBucket < 0) continue;
    const arr = buckets.get(curBucket);
    if (arr) arr.push(tok);
    else buckets.set(curBucket, [tok]);
  }

  const keys = [...buckets.keys()].sort((a, b) => a - b);
  return keys.map((key, i) => {
    const toks = buckets.get(key)!;
    const wordsIn = toks.filter((t) => t.type === "word");
    const speakers = [...new Set(wordsIn.map((t) => t.speaker_id))];
    return {
      index: i + 1, // contiguous, skipping silent windows
      kind: "time" as const,
      text: fmtSpeakerLines(toks),
      startTime: wordsIn[0].start,
      endTime: wordsIn[wordsIn.length - 1].end,
      wordCount: wordsIn.length,
      speakers,
    };
  });
}
