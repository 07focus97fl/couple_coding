import { TranscriptWord, SpeakingTurn } from "./types";

export function parseTranscript(words: TranscriptWord[]): SpeakingTurn[] {
  if (words.length === 0) return [];

  const turns: SpeakingTurn[] = [];
  let currentSpeaker: string | null = null;
  let currentWords: TranscriptWord[] = [];

  function flushTurn() {
    if (currentWords.length === 0 || currentSpeaker === null) return;

    const text = currentWords.map((w) => w.text).join("");
    const wordCount = currentWords.filter((w) => w.type === "word").length;
    const wordEntries = currentWords.filter((w) => w.type === "word");
    const startTime = wordEntries[0]?.start ?? currentWords[0].start;
    const endTime = wordEntries[wordEntries.length - 1]?.end ?? currentWords[currentWords.length - 1].end;

    turns.push({
      turnNumber: turns.length + 1,
      speaker: currentSpeaker,
      text: text.trim(),
      wordCount,
      startTime,
      endTime,
    });
  }

  for (const word of words) {
    if (word.type === "word" && word.speaker_id !== currentSpeaker) {
      flushTurn();
      currentSpeaker = word.speaker_id;
      currentWords = [word];
    } else {
      currentWords.push(word);
    }
  }

  flushTurn();
  return turns;
}
