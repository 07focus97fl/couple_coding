"use client";
/**
 * WHAT:    Step 2 (Model) state: which model is selected, its reasoning level, and
 *          the three provider API keys. Derives the active provider and the key
 *          that goes with the selected model.
 * STEP:    Model. Rendered by components/sections/SectionModel.tsx; composed into
 *          the session by useCodingSession.ts.
 * RUNS ON: client only
 * STORAGE: localStorage "anthropic_api_key", "openai_api_key", "google_api_key"
 */
import { useCallback, useMemo, useState } from "react";
import {
  DEFAULT_REASONING_LEVEL,
  getModel,
  reasoningLevelsFor,
  type ProviderId,
  type ReasoningLevel,
} from "@/lib/models";
import type { PersistedSession } from "./autosave-schema";

export interface ModelAndKeysState {
  selectedModel: string;
  setSelectedModel: (id: string) => void;
  reasoningLevel: ReasoningLevel;
  setReasoningLevel: (l: ReasoningLevel) => void;
  anthropicKey: string;
  setAnthropicKey: (k: string) => void;
  openaiKey: string;
  setOpenaiKey: (k: string) => void;
  googleKey: string;
  setGoogleKey: (k: string) => void;
  // Derived from the selected model: its provider and the matching key.
  activeProvider: ProviderId;
  activeProviderKey: string;
  modelName: string;

  // For sibling hooks (not part of the public session)
  /** Read the three provider keys from localStorage (hydration). */
  loadStoredKeys: () => void;
  /** Restore model + reasoning level from an autosave snapshot (hydration). */
  restoreModel: (parsed: PersistedSession) => void;
}

export function useModelAndKeys(): ModelAndKeysState {
  const [anthropicKey, setAnthropicKeyState] = useState("");
  const [openaiKey, setOpenaiKeyState] = useState("");
  const [googleKey, setGoogleKeyState] = useState("");
  // Empty until the user explicitly picks a model — nothing is preselected, so the
  // API-key field only appears once a provider is chosen.
  const [selectedModel, setSelectedModel] = useState("");
  const [pickedReasoningLevel, setReasoningLevel] = useState<ReasoningLevel>(
    DEFAULT_REASONING_LEVEL,
  );
  // Levels vary by model (GPT-6 Luna adds xhigh/max). If the pick isn't offered
  // by the selected model, use the default so the UI never shows a hidden choice.
  const modelLevels = reasoningLevelsFor(getModel(selectedModel));
  const reasoningLevel = modelLevels.includes(pickedReasoningLevel)
    ? pickedReasoningLevel
    : DEFAULT_REASONING_LEVEL;

  // Called once on mount by useSessionPersistence (keys are never in the
  // autosave blob; they live under their own localStorage entries).
  const loadStoredKeys = useCallback(() => {
    const storedKey = localStorage.getItem("anthropic_api_key");
    if (storedKey) setAnthropicKeyState(storedKey);
    const storedOpenai = localStorage.getItem("openai_api_key");
    if (storedOpenai) setOpenaiKeyState(storedOpenai);
    const storedGoogle = localStorage.getItem("google_api_key");
    if (storedGoogle) setGoogleKeyState(storedGoogle);
  }, []);

  const modelName = useMemo(() => {
    return getModel(selectedModel)?.name ?? "";
  }, [selectedModel]);

  // The selected model's provider and the API key that goes with it.
  const activeProvider: ProviderId =
    getModel(selectedModel)?.provider ?? "anthropic";
  const activeProviderKey =
    activeProvider === "openai"
      ? openaiKey
      : activeProvider === "google"
      ? googleKey
      : anthropicKey;

  // ── Handlers ──

  const setAnthropicKey = useCallback((val: string) => {
    setAnthropicKeyState(val);
    if (val) localStorage.setItem("anthropic_api_key", val);
    else localStorage.removeItem("anthropic_api_key");
  }, []);

  const setOpenaiKey = useCallback((val: string) => {
    setOpenaiKeyState(val);
    if (val) localStorage.setItem("openai_api_key", val);
    else localStorage.removeItem("openai_api_key");
  }, []);

  const setGoogleKey = useCallback((val: string) => {
    setGoogleKeyState(val);
    if (val) localStorage.setItem("google_api_key", val);
    else localStorage.removeItem("google_api_key");
  }, []);

  const restoreModel = useCallback((parsed: PersistedSession) => {
    if (parsed.selectedModel) {
      // Guard against stale/removed model IDs in old saved sessions —
      // clear the selection rather than restoring a dead ID.
      const restored = getModel(parsed.selectedModel);
      setSelectedModel(
        restored && !restored.comingSoon ? parsed.selectedModel : "",
      );
    }
    setReasoningLevel(parsed.reasoningLevel ?? DEFAULT_REASONING_LEVEL);
  }, []);

  return {
    selectedModel,
    setSelectedModel,
    reasoningLevel,
    setReasoningLevel,
    anthropicKey,
    setAnthropicKey,
    openaiKey,
    setOpenaiKey,
    googleKey,
    setGoogleKey,
    activeProvider,
    activeProviderKey,
    modelName,

    loadStoredKeys,
    restoreModel,
  };
}
