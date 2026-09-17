/**
 * WHAT:    The shape of the saved session (PersistedSession), its serializer, and
 *          the migration that upgrades older saves (v3 to v7) on load.
 * STEP:    Shared. Used by useSessionPersistence and useAutosave.
 * RUNS ON: client
 * STORAGE: localStorage "ccc_session_v3" (the key name is frozen; see the note
 *          below)
 */
import {
  CategoryDefinition,
  CsvSource,
  OutputType,
  RatingScale,
  RawTranscript,
  SegmentationStrategy,
  DEFAULT_CONTEXT_BEFORE,
  DEFAULT_CONTEXT_AFTER,
  DEFAULT_OUTPUT_TYPE,
  DEFAULT_SCALE,
  DEFAULT_WINDOW_SECONDS,
  DEFAULT_BATCH_SIZE,
} from "@/lib/types";
import { DEFAULT_REASONING_LEVEL, ReasoningLevel } from "@/lib/models";

// The schema version written by serialize(); bump it when PersistedSession
// changes and add a migration line in deserialize().
export const AUTOSAVE_VERSION = 7 as const;
// NOTE: the storage key string is intentionally kept as "ccc_session_v3" even
// though the schema is now v7. Renaming it would orphan existing saved sessions;
// instead deserialize() migrates older payloads in place (see below).
export const AUTOSAVE_KEY = "ccc_session_v3";
export const AUTOSAVE_MAX_BYTES = 3_000_000;

export interface PersistedFile {
  id: string;
  fileName: string;
  rawTranscript: RawTranscript | null;
  selected: boolean;
  topic?: string;
  /** The rows of a CSV-origin conversation (v7+). Absent on JSON/audio files. */
  source?: CsvSource;
}

export interface PersistedSession {
  version: typeof AUTOSAVE_VERSION;
  files: PersistedFile[];
  selectedModel: string;
  reasoningLevel: ReasoningLevel;
  schemeId: string | null;
  segmentation: SegmentationStrategy;
  outputType: OutputType;
  scale: RatingScale;
  windowSeconds: number;
  perSpeaker: boolean;
  batchSize: number;
  categories: CategoryDefinition[];
  categoriesDirty: boolean;
  systemPrompt: string;
  promptDirty: boolean;
  contextBefore: number;
  contextAfter: number;
}

export function serialize(session: PersistedSession): string {
  return JSON.stringify(session);
}

export function deserialize(raw: string): PersistedSession | null {
  try {
    const p = JSON.parse(raw) as Partial<Omit<PersistedSession, "version">> & {
      version?: number;
      /** Legacy single-window field (pre-before/after split); migrated to contextBefore. */
      contextWindow?: number;
      /** Legacy (v3) turn/utterance axis; migrated to segmentation. */
      granularity?: string;
    };
    if (!p.files || !Array.isArray(p.files)) return null;
    if (typeof p.systemPrompt !== "string") return null;
    if (!p.categories || !Array.isArray(p.categories)) return null;
    if (
      p.version !== 3 &&
      p.version !== 4 &&
      p.version !== 5 &&
      p.version !== 6 &&
      p.version !== AUTOSAVE_VERSION
    )
      return null;

    // Migrate v3 -> v4 (granularity -> segmentation axis), v4 -> v5 (perSpeaker,
    // default on), v5 -> v6 (batchSize, default 1), and v6 -> v7 (files[].source:
    // the rows of a CSV-origin conversation; absent on JSON/audio files, so v6
    // file entries pass through unchanged). v7 payloads pass through.
    const legacySegmentation: SegmentationStrategy =
      p.granularity === "utterance" ? "utterance" : "turn";
    return {
      version: AUTOSAVE_VERSION,
      files: p.files,
      selectedModel: p.selectedModel ?? "",
      reasoningLevel: p.reasoningLevel ?? DEFAULT_REASONING_LEVEL,
      schemeId: p.schemeId ?? null,
      segmentation: p.segmentation ?? legacySegmentation,
      outputType: p.outputType ?? DEFAULT_OUTPUT_TYPE,
      scale: p.scale ?? DEFAULT_SCALE,
      windowSeconds: p.windowSeconds ?? DEFAULT_WINDOW_SECONDS,
      perSpeaker: p.perSpeaker ?? true,
      batchSize: p.batchSize ?? DEFAULT_BATCH_SIZE,
      categories: p.categories,
      categoriesDirty: p.categoriesDirty ?? false,
      systemPrompt: p.systemPrompt,
      promptDirty: p.promptDirty ?? false,
      contextBefore: p.contextBefore ?? p.contextWindow ?? DEFAULT_CONTEXT_BEFORE,
      contextAfter: p.contextAfter ?? DEFAULT_CONTEXT_AFTER,
    };
  } catch {
    return null;
  }
}

/**
 * The over-budget fallback: drop the word-level transcripts (the bulk of a
 * saved session). CSV-origin `source` rows are small and are kept, so those
 * files still come back after a reload.
 */
export function stripRawTranscripts(
  session: PersistedSession,
): PersistedSession {
  return {
    ...session,
    files: session.files.map((f) => ({ ...f, rawTranscript: null })),
  };
}
