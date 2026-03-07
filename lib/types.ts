export interface TranscriptWord {
  text: string;
  start: number;
  end: number;
  type: "word" | "spacing";
  speaker_id: string;
  characters: { text: string; start: number; end: number }[] | null;
}

export interface RawTranscript {
  language_code: string;
  language_probability: number;
  text: string;
  words: TranscriptWord[];
}

export interface SpeakingTurn {
  turnNumber: number;
  speaker: string;
  text: string;
  wordCount: number;
  startTime: number;
  endTime: number;
}

export interface CodedTurn extends SpeakingTurn {
  category: string;
}

export type ColumnKey =
  | "turnNumber"
  | "speaker"
  | "text"
  | "wordCount"
  | "category"
  | "startTime"
  | "endTime";

export type SpeakerFilter = "all" | "speaker_0" | "speaker_1";

export interface ExportConfig {
  visibleColumns: ColumnKey[];
  speakerFilter: SpeakerFilter;
}

export const COLUMN_DEFINITIONS: { key: ColumnKey; label: string; csvHeader: string }[] = [
  { key: "turnNumber", label: "#", csvHeader: "Turn Number" },
  { key: "speaker", label: "Speaker", csvHeader: "Speaker" },
  { key: "text", label: "Text", csvHeader: "Text" },
  { key: "wordCount", label: "Words", csvHeader: "Word Count" },
  { key: "category", label: "Category", csvHeader: "Category" },
  { key: "startTime", label: "Start (s)", csvHeader: "Start Time (s)" },
  { key: "endTime", label: "End (s)", csvHeader: "End Time (s)" },
];

export const DEFAULT_WORD_COUNT_THRESHOLD = 50;

export const DEFAULT_EXPORT_CONFIG: ExportConfig = {
  visibleColumns: COLUMN_DEFINITIONS.map((c) => c.key),
  speakerFilter: "all",
};
