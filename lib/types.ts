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

export type Granularity = "turn" | "utterance";

export interface CodingUnit {
  unitId: string;
  turnNumber: number;
  utteranceIndex?: number;
  speaker: string;
  text: string;
  startTime: number;
  endTime: number;
  wordCount: number;
  approximateTiming?: boolean;
}

export interface CodedUnit extends CodingUnit {
  category: string;
  rationale: string;
}

export type CodedTurn = CodedUnit;

export type ColumnKey =
  | "unitId"
  | "turnNumber"
  | "utteranceIndex"
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
  { key: "unitId", label: "Unit", csvHeader: "Unit ID" },
  { key: "turnNumber", label: "#", csvHeader: "Turn Number" },
  { key: "utteranceIndex", label: "Utt", csvHeader: "Utterance Index" },
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
  rules?: string;
  comingSoon?: boolean;
  badge?: string;
  authoredFor?: Granularity;
}

export interface PromptBlocks {
  role: string;
  granularity: string;
  categories: string;
  rules: string;
  contextFraming: string;
  outputInstruction: string;
}

export type PromptBlockKey = keyof PromptBlocks;

export type PromptBlockDirty = { [K in PromptBlockKey]: boolean };

export const PROMPT_BLOCK_ORDER: PromptBlockKey[] = [
  "role",
  "granularity",
  "categories",
  "rules",
  "contextFraming",
  "outputInstruction",
];

export const PROMPT_BLOCK_LABELS: Record<PromptBlockKey, string> = {
  role: "ROLE",
  granularity: "GRANULARITY",
  categories: "CATEGORIES",
  rules: "RULES",
  contextFraming: "CONTEXT FRAMING",
  outputInstruction: "OUTPUT INSTRUCTION",
};

export interface TranscriptFile {
  id: string;
  fileName: string;
  rawTranscript: RawTranscript;
  turns: SpeakingTurn[];
  codedUnits: CodedUnit[];
  selected: boolean;
  status: 'pending' | 'coding' | 'done' | 'error';
  progress: { completed: number; total: number };
  error?: string;
}

export interface ApiLogParsedUnit {
  unitId: string;
  category: string;
  rationale: string;
  text?: string;
}

export interface ApiLog {
  turnNumber: number;
  speaker: string;
  granularity: Granularity;
  unitIds: string[];
  model: string;
  systemPrompt: string;
  userMessage: string;
  toolDefinition: object;
  rawResponse: object;
  parsedUnits: ApiLogParsedUnit[];
  attempt: number;
  timestamp: string;
}

export const DEFAULT_CONTEXT_WINDOW = 5;
export const DEFAULT_GRANULARITY: Granularity = "turn";

export const DEFAULT_EXPORT_CONFIG: ExportConfig = {
  visibleColumns: COLUMN_DEFINITIONS.map((c) => c.key),
  speakerFilter: "all",
};
