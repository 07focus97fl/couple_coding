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
  rationale: string;
}

export type ColumnKey =
  | "turnNumber"
  | "speaker"
  | "text"
  | "wordCount"
  | "category"
  | "rationale"
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
  { key: "rationale", label: "Rationale", csvHeader: "Rationale" },
  { key: "startTime", label: "Start (s)", csvHeader: "Start Time (s)" },
  { key: "endTime", label: "End (s)", csvHeader: "End Time (s)" },
];

export interface CategoryDefinition {
  name: string;
  description: string;
}

export interface CodingScheme {
  id: string;
  label: string;
  description: string;
  categories: CategoryDefinition[];
  comingSoon?: boolean;
}

export const CODING_SCHEMES: CodingScheme[] = [
  {
    id: "valence",
    label: "Valence",
    description: "Positive vs. negative affect coding",
    categories: [
      { name: "positive", description: "The speaker expresses warmth, affection, agreement, humor, validation, or emotional support." },
      { name: "negative", description: "The speaker expresses criticism, contempt, defensiveness, hostility, dismissiveness, or emotional withdrawal." },
    ],
  },
  {
    id: "SPAFF",
    label: "SPAFF",
    description: "Specific Affect Coding System (Gottman)",
    categories: [],
    comingSoon: true,
  },
  {
    id: "RCISS",
    label: "RCISS",
    description: "Rapid Couples Interaction Scoring System",
    categories: [],
    comingSoon: true,
  },
  {
    id: "CIRS",
    label: "CIRS",
    description: "Couples Interaction Rating System",
    categories: [],
    comingSoon: true,
  },
  {
    id: "custom",
    label: "Custom",
    description: "Define your own categories",
    categories: [
      { name: "", description: "" },
      { name: "", description: "" },
    ],
  },
];

export interface TranscriptFile {
  id: string;
  fileName: string;
  rawTranscript: RawTranscript;
  turns: SpeakingTurn[];
  codedTurns: CodedTurn[];
  selected: boolean;
  status: 'pending' | 'coding' | 'done' | 'error';
  progress: { completed: number; total: number };
  error?: string;
}

export const DEFAULT_CONTEXT_WINDOW = 5;

export const DEFAULT_EXPORT_CONFIG: ExportConfig = {
  visibleColumns: COLUMN_DEFINITIONS.map((c) => c.key),
  speakerFilter: "all",
};
