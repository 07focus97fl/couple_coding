import {
  CategoryDefinition,
  Granularity,
  PromptBlockDirty,
  PromptBlocks,
  RawTranscript,
} from "./types";

export const AUTOSAVE_KEY = "ccc_session_v1";
export const AUTOSAVE_MAX_BYTES = 3_000_000;

export type UploadMode = "audio" | "transcript";

export interface PersistedFile {
  id: string;
  fileName: string;
  rawTranscript: RawTranscript | null;
  selected: boolean;
}

export interface PersistedSession {
  version: 1;
  uploadMode: UploadMode;
  files: PersistedFile[];
  selectedModel: string;
  schemeId: string | null;
  granularity: Granularity;
  categories: CategoryDefinition[];
  categoriesDirty: boolean;
  blocks: PromptBlocks;
  dirty: PromptBlockDirty;
  rawSystemOverride: string | null;
  contextWindow: number;
}

export function serialize(session: PersistedSession): string {
  return JSON.stringify(session);
}

export function deserialize(raw: string): PersistedSession | null {
  try {
    const parsed = JSON.parse(raw) as Partial<PersistedSession>;
    if (parsed.version !== 1) return null;
    if (!parsed.files || !Array.isArray(parsed.files)) return null;
    if (!parsed.blocks || typeof parsed.blocks !== "object") return null;
    if (!parsed.categories || !Array.isArray(parsed.categories)) return null;
    return parsed as PersistedSession;
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
