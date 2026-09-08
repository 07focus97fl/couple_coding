"use client";
/**
 * WHAT:    Loads the saved session from localStorage on first render (hydration)
 *          and keeps a snapshot of everything worth saving, which useAutosave
 *          writes back after a short delay. Coded results and API logs are not
 *          persisted, only inputs and settings.
 * STEP:    Shared across all four steps. Composed by useCodingSession.ts.
 *          The saved shape and its migrations live in autosave-schema.ts.
 * RUNS ON: client only
 * STORAGE: localStorage "ccc_session_v3" (read here; written by useAutosave.ts)
 */
import { useEffect, useMemo, useState } from "react";
import { AUTOSAVE_KEY, deserialize, PersistedSession } from "./autosave-schema";
import { useAutosave, AutosaveState } from "./useAutosave";
import type { TranscriptFilesState } from "./useTranscriptFiles";
import type { ModelAndKeysState } from "./useModelAndKeys";
import type { SchemeSettingsState } from "./useSchemeSettings";

export function useSessionPersistence({
  upload,
  model,
  scheme,
  isAnyCoding,
}: {
  upload: TranscriptFilesState;
  model: ModelAndKeysState;
  scheme: SchemeSettingsState;
  isAnyCoding: boolean;
}): AutosaveState {
  const [hydrated, setHydrated] = useState(false);

  const { files, restoreFiles, loadStoredKeys: loadStoredElevenLabsKey } = upload;
  const { selectedModel, reasoningLevel, restoreModel, loadStoredKeys } = model;
  const {
    schemeId,
    granularity,
    segmentation,
    outputType,
    scale,
    windowSeconds,
    perSpeaker,
    batchSize,
    categories,
    categoriesDirty,
    systemPrompt,
    promptDirty,
    contextBefore,
    contextAfter,
    restoreSettings,
  } = scheme;

  // Hydrate once on mount: provider keys first, then the saved session.
  useEffect(() => {
    loadStoredKeys();
    loadStoredElevenLabsKey();
    try {
      const raw = localStorage.getItem(AUTOSAVE_KEY);
      if (raw) {
        const parsed = deserialize(raw);
        if (parsed) {
          restoreFiles(parsed.files);
          restoreModel(parsed);
          restoreSettings(parsed);
        }
      }
    } catch {
      /* corrupt — discard */
    } finally {
      setHydrated(true);
    }
  }, [
    loadStoredKeys,
    loadStoredElevenLabsKey,
    restoreFiles,
    restoreModel,
    restoreSettings,
  ]);

  // The snapshot to save. Null until hydrated (so a fresh page never overwrites
  // a saved session with defaults) and null during a run (autosave pauses).
  const persistedSession: PersistedSession | null = useMemo(() => {
    if (!hydrated) return null;
    if (isAnyCoding) return null;
    return {
      version: 6,
      files: files.map((f) => ({
        id: f.id,
        fileName: f.fileName,
        rawTranscript: f.rawTranscript,
        selected: f.selected,
        topic: f.topic ?? "",
      })),
      selectedModel,
      reasoningLevel,
      schemeId,
      granularity,
      segmentation,
      outputType,
      scale,
      windowSeconds,
      perSpeaker,
      batchSize,
      categories,
      categoriesDirty,
      systemPrompt,
      promptDirty,
      contextBefore,
      contextAfter,
    };
  }, [
    hydrated,
    files,
    selectedModel,
    reasoningLevel,
    schemeId,
    granularity,
    segmentation,
    outputType,
    scale,
    windowSeconds,
    perSpeaker,
    batchSize,
    categories,
    categoriesDirty,
    systemPrompt,
    promptDirty,
    contextBefore,
    contextAfter,
    isAnyCoding,
  ]);

  return useAutosave(persistedSession, hydrated && !isAnyCoding);
}
