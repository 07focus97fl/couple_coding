import {
  CategoryDefinition,
  Granularity,
  OutputType,
  RatingScale,
  RawTranscript,
  SegmentationStrategy,
  DEFAULT_CONTEXT_WINDOW,
  DEFAULT_OUTPUT_TYPE,
  DEFAULT_SCALE,
  DEFAULT_WINDOW_SECONDS,
} from "./types";

// NOTE: the storage key string is intentionally kept as "ccc_session_v3" even
// though the schema is now v4. Renaming it would orphan existing saved sessions;
// instead we migrate v3 payloads in place via deserialize() (see below).
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
  version: 4;
  files: PersistedFile[];
  selectedModel: string;
  schemeId: string | null;
  granularity: Granularity;
  segmentation: SegmentationStrategy;
  outputType: OutputType;
  scale: RatingScale;
  windowSeconds: number;
  categories: CategoryDefinition[];
  categoriesDirty: boolean;
  systemPrompt: string;
  promptDirty: boolean;
  contextWindow: number;
}

export function serialize(session: PersistedSession): string {
  return JSON.stringify(session);
}

export function deserialize(raw: string): PersistedSession | null {
  try {
    const p = JSON.parse(raw) as Partial<Omit<PersistedSession, "version">> & {
      version?: number;
    };
    if (!p.files || !Array.isArray(p.files)) return null;
    if (typeof p.systemPrompt !== "string") return null;
    if (!p.categories || !Array.isArray(p.categories)) return null;
    if (p.version !== 3 && p.version !== 4) return null;

    // Migrate v3 -> v4: map the single granularity axis onto the new
    // segmentation axis and default the rest. v4 payloads pass through.
    const granularity: Granularity =
      p.granularity === "utterance" ? "utterance" : "turn";
    return {
      version: 4,
      files: p.files,
      selectedModel: p.selectedModel ?? "",
      schemeId: p.schemeId ?? null,
      granularity,
      segmentation: p.segmentation ?? granularity,
      outputType: p.outputType ?? DEFAULT_OUTPUT_TYPE,
      scale: p.scale ?? DEFAULT_SCALE,
      windowSeconds: p.windowSeconds ?? DEFAULT_WINDOW_SECONDS,
      categories: p.categories,
      categoriesDirty: p.categoriesDirty ?? false,
      systemPrompt: p.systemPrompt,
      promptDirty: p.promptDirty ?? false,
      contextWindow: p.contextWindow ?? DEFAULT_CONTEXT_WINDOW,
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
