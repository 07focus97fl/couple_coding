import { SpeakingTurn, TranscriptFile } from "./types";

export interface PreviewSample {
  targetTurn: SpeakingTurn;
  contextTurns: SpeakingTurn[];
}

const FIXTURE_TURNS: SpeakingTurn[] = [
  {
    turnNumber: 1,
    speaker: "speaker_0",
    text: "I just feel like you're not listening to me when I try to explain.",
    wordCount: 13,
    startTime: 0,
    endTime: 4.2,
  },
  {
    turnNumber: 2,
    speaker: "speaker_1",
    text: "I am listening. I just don't agree with what you're saying.",
    wordCount: 11,
    startTime: 4.3,
    endTime: 7.1,
  },
  {
    turnNumber: 3,
    speaker: "speaker_0",
    text: "Then why do you keep cutting me off? You always do this.",
    wordCount: 12,
    startTime: 7.2,
    endTime: 10.4,
  },
  {
    turnNumber: 4,
    speaker: "speaker_1",
    text: "That's ridiculous, I did no such thing — you interrupted me first.",
    wordCount: 12,
    startTime: 10.5,
    endTime: 14.0,
  },
];

export function buildPreviewSample(
  files: TranscriptFile[],
  contextWindow: number
): PreviewSample {
  const selected = files.find((f) => f.selected && f.turns.length > 0);
  const source = selected?.turns ?? FIXTURE_TURNS;

  const targetIndex = Math.min(source.length - 1, Math.max(0, Math.min(3, source.length - 1)));
  const target = source[targetIndex];
  const ctxStart = Math.max(0, targetIndex - Math.min(contextWindow, 3));
  const context = source.slice(ctxStart, targetIndex);

  return { targetTurn: target, contextTurns: context };
}
