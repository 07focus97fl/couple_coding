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

/**
 * How a transcript is divided into codeable units (axis A).
 * - "turn": one unit per speaking turn (deterministic, by speaker change)
 * - "utterance": the model sub-segments a turn into coherent behavioral acts
 * - "time": fixed-duration windows that may span multiple speakers
 */
export type SegmentationStrategy = "turn" | "utterance" | "time";

/** What the model emits per unit (axis B). */
export type OutputType = "categorical" | "continuous";

export interface RatingScale {
  min: number;
  max: number;
  step?: number;
  minLabel?: string;
  maxLabel?: string;
}

/** The full descriptor of a coding run, threaded end-to-end. */
export interface CodingMode {
  segmentation: SegmentationStrategy;
  outputType: OutputType;
  /** Present when outputType === "continuous". */
  scale?: RatingScale;
  /** Present when segmentation === "time". */
  windowSeconds?: number;
}

/** Inputs a scheme's prompt generator needs. */
export interface PromptOptions {
  segmentation: SegmentationStrategy;
  outputType: OutputType;
  scale?: RatingScale;
}

export interface CodingUnit {
  unitId: string;
  /** Set for turn/utterance units; absent for time windows. */
  turnNumber?: number;
  utteranceIndex?: number;
  /** Single speaker for turn/utterance units; absent for multi-speaker time windows. */
  speaker?: string;
  /** Speakers present in a time window. */
  speakers?: string[];
  text: string;
  startTime: number;
  endTime: number;
  wordCount: number;
  approximateTiming?: boolean;
  /** Which segmentation produced this unit. */
  kind?: "turn" | "utterance" | "time";
}

export interface CodedUnit extends CodingUnit {
  /** Present for categorical output. */
  category?: string;
  rationale: string;
  subcategory?: string | null;
  alternativesConsidered?: string[];
  /** Present for continuous output: dimension name -> numeric rating. */
  ratings?: Record<string, number>;
  /** True when the model response could not be parsed. */
  error?: boolean;
}

export type CodedTurn = CodedUnit;

/**
 * A pre-segmented chunk of transcript handed to the coding API. Produced by a
 * segmenter (turns via parseTranscript, windows via segmentByTime) so the API
 * loop stays agnostic to how units were cut.
 */
export interface PreSegment {
  /** 1-based ordinal within the file; drives ordering and context windows. */
  index: number;
  kind: "turn" | "time";
  text: string;
  startTime: number;
  endTime: number;
  wordCount: number;
  /** Set when kind === "turn". */
  turnNumber?: number;
  speaker?: string;
  /** Set when kind === "time". */
  speakers?: string[];
}

export type ColumnKey =
  | "unitId"
  | "turnNumber"
  | "utteranceIndex"
  | "speaker"
  | "text"
  | "wordCount"
  | "category"
  | "subcategory"
  | "alternativesConsidered"
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
  { key: "subcategory", label: "Subcat", csvHeader: "Subcategory" },
  { key: "alternativesConsidered", label: "Alts", csvHeader: "Alternatives Considered" },
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
  defaultPrompt: (opts: PromptOptions) => string;
  comingSoon?: boolean;
  badge?: string;
}

export interface TranscriptFile {
  id: string;
  fileName: string;
  rawTranscript: RawTranscript | null;
  turns: SpeakingTurn[];
  codedUnits: CodedUnit[];
  selected: boolean;
  status: 'pending' | 'coding' | 'done' | 'error';
  progress: { completed: number; total: number };
  error?: string;
  audioSource?: File;
  transcribeStatus?: 'pending' | 'transcribing' | 'done' | 'error';
  transcribeError?: string;
  topic?: string;
}

export interface ApiLogParsedUnit {
  unitId: string;
  category?: string;
  rationale: string;
  text?: string;
  subcategory?: string | null;
  alternativesConsidered?: string[];
  ratings?: Record<string, number>;
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
  /** Configured max number of prior turns to feed the model as context. */
  contextWindow: number;
  /** Turn numbers actually sent as prior context (fewer than contextWindow near the start of a transcript). */
  contextTurnNumbers: number[];
}

export const DEFAULT_CONTEXT_WINDOW = 5;
export const DEFAULT_GRANULARITY: Granularity = "turn";
export const DEFAULT_SEGMENTATION: SegmentationStrategy = "turn";
export const DEFAULT_OUTPUT_TYPE: OutputType = "categorical";
export const DEFAULT_WINDOW_SECONDS = 30;
export const DEFAULT_SCALE: RatingScale = {
  min: 1,
  max: 7,
  step: 1,
  minLabel: "not present",
  maxLabel: "strongly present",
};

export const DEFAULT_EXPORT_CONFIG: ExportConfig = {
  visibleColumns: COLUMN_DEFINITIONS.map((c) => c.key),
  speakerFilter: "all",
};
