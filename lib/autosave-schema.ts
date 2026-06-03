import {
  CategoryDefinition,
  Granularity,
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
} from "./types";
import { DEFAULT_REASONING_LEVEL, ReasoningLevel } from "./models";

// NOTE: the storage key string is intentionally kept as "ccc_session_v3" even
// though the schema is now v5. Renaming it would orphan existing saved sessions;
// instead we migrate v3/v4 payloads in place via deserialize() (see below).
export const AUTOSAVE_KEY = "ccc_session_v3";
export const AUTOSAVE_MAX_BYTES = 3_000_000;

export interface PersistedFile {
  id: string;
  fileName: string;
  rawTranscript: RawTranscript | null;
  selected: boolean;
  topic?: string;
}

export interface PersistedSession {
  version: 6;
  files: PersistedFile[];
  selectedModel: string;
  reasoningLevel: ReasoningLevel;
  schemeId: string | null;
  granularity: Granularity;
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
    };
    if (!p.files || !Array.isArray(p.files)) return null;
    if (typeof p.systemPrompt !== "string") return null;
    if (!p.categories || !Array.isArray(p.categories)) return null;
    if (
      p.version !== 3 &&
      p.version !== 4 &&
      p.version !== 5 &&
      p.version !== 6
    )
      return null;

    // Migrate v3 -> v4 (granularity -> segmentation axis), v4 -> v5 (perSpeaker,
    // default on), and v5 -> v6 (batchSize, default 1). v6 payloads pass through.
    const granularity: Granularity =
      p.granularity === "utterance" ? "utterance" : "turn";
    return {
      version: 6,
      files: p.files,
      selectedModel: p.selectedModel ?? "",
      reasoningLevel: p.reasoningLevel ?? DEFAULT_REASONING_LEVEL,
      schemeId: p.schemeId ?? null,
      granularity,
      segmentation: p.segmentation ?? granularity,
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

export function stripRawTranscripts(
  session: PersistedSession,
): PersistedSession {
  return {
    ...session,
    files: session.files.map((f) => ({ ...f, rawTranscript: null })),
  };
}
