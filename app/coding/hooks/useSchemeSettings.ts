"use client";
/**
 * WHAT:    Step 3 (Scheme) state: which coding scheme is active, its editable
 *          categories, the coding mode (segmentation, output type, rating scale,
 *          window size, per-speaker, batch size), the editable system prompt, and
 *          how much context surrounds each unit. A scheme whose definitions are
 *          worded per mode (VTCS: per turn or per utterance) gets its categories
 *          regenerated along with the prompt when the mode changes.
 * STEP:    Scheme. Rendered by components/sections/SectionScheme.tsx (+ PromptEditor,
 *          TopicTable); composed into the session by useCodingSession.ts.
 * RUNS ON: client only
 */
import { useCallback, useMemo, useState } from "react";
import {
  CategoryDefinition,
  CodingScheme,
  PromptOptions,
  DEFAULT_CONTEXT_BEFORE,
  DEFAULT_CONTEXT_AFTER,
  DEFAULT_OUTPUT_TYPE,
  DEFAULT_SCALE,
  DEFAULT_SEGMENTATION,
  DEFAULT_WINDOW_SECONDS,
  DEFAULT_BATCH_SIZE,
  OutputType,
  RatingScale,
  SegmentationStrategy,
} from "@/lib/types";
import { CODING_SCHEMES } from "@/lib/schemes";
import { buildColorMap } from "@/lib/results/category-colors";
import type { PersistedSession } from "./autosave-schema";

// VTCS is the flagship scheme; a fresh session boots with it selected and its
// categories/prompt populated. The autosave hydration effect overrides these
// for returning users, so this only affects first-time / cleared sessions.
const DEFAULT_SCHEME_ID = "vtcs";
const DEFAULT_SCHEME =
  CODING_SCHEMES.find((sc) => sc.id === DEFAULT_SCHEME_ID) ?? null;

/** The scheme's default categories for a mode. */
function schemeCategories(
  scheme: CodingScheme,
  opts: PromptOptions,
): CategoryDefinition[] {
  return scheme.categoriesFor?.(opts) ?? scheme.categories;
}

function sameCategories(
  a: CategoryDefinition[],
  b: CategoryDefinition[],
): boolean {
  return (
    a.length === b.length &&
    a.every(
      (c, i) => c.name === b[i]?.name && c.description === b[i]?.description,
    )
  );
}

export interface SchemeSettingsState {
  schemeId: string | null;
  activeScheme: CodingScheme | null;
  categories: CategoryDefinition[];
  categoriesDirty: boolean;
  segmentation: SegmentationStrategy;
  outputType: OutputType;
  scale: RatingScale;
  windowSeconds: number;
  perSpeaker: boolean;
  batchSize: number;
  systemPrompt: string;
  promptDirty: boolean;
  contextBefore: number;
  contextAfter: number;
  setSchemeId: (id: string) => void;
  setSegmentation: (s: SegmentationStrategy) => void;
  setOutputType: (o: OutputType) => void;
  setScale: (s: RatingScale) => void;
  setWindowSeconds: (n: number) => void;
  setPerSpeaker: (b: boolean) => void;
  setBatchSize: (n: number) => void;
  setCategories: (c: CategoryDefinition[]) => void;
  resetCategories: () => void;
  setSystemPrompt: (v: string) => void;
  resetPrompt: () => void;
  setContextBefore: (n: number) => void;
  setContextAfter: (n: number) => void;

  // Derived
  schemeName: string;
  categoryColorMap: Record<string, string>;

  // For sibling hooks (not part of the public session)
  /** Restore every setting from an autosave snapshot, bypassing the
   *  confirm-on-dirty prompt regeneration (hydration). */
  restoreSettings: (parsed: PersistedSession) => void;
}

export function useSchemeSettings(): SchemeSettingsState {
  const [schemeId, setSchemeIdState] = useState<string | null>(
    DEFAULT_SCHEME_ID,
  );
  const [segmentation, setSegmentationState] = useState<SegmentationStrategy>(
    DEFAULT_SEGMENTATION,
  );
  const [outputType, setOutputTypeState] = useState<OutputType>(
    DEFAULT_OUTPUT_TYPE,
  );
  const [scale, setScaleState] = useState<RatingScale>(DEFAULT_SCALE);
  const [windowSeconds, setWindowSecondsState] = useState<number>(
    DEFAULT_WINDOW_SECONDS,
  );
  // Per-speaker time coding is on by default; only affects time segmentation.
  const [perSpeaker, setPerSpeakerState] = useState<boolean>(true);
  // How many consecutive pre-segments to code per API call (cost reduction);
  // 1 = one unit per call. Auto-capped server-side for large units.
  const [batchSize, setBatchSizeState] = useState<number>(DEFAULT_BATCH_SIZE);
  const [categories, setCategoriesState] = useState<CategoryDefinition[]>(
    () => DEFAULT_SCHEME?.categories ?? [],
  );
  const [categoriesDirty, setCategoriesDirty] = useState(false);
  const [systemPrompt, setSystemPromptState] = useState(() =>
    DEFAULT_SCHEME
      ? DEFAULT_SCHEME.defaultPrompt({
          segmentation: DEFAULT_SEGMENTATION,
          outputType: DEFAULT_OUTPUT_TYPE,
          scale: DEFAULT_SCALE,
          perSpeaker: true,
        })
      : "",
  );
  const [promptDirty, setPromptDirty] = useState(false);
  const [contextBefore, setContextBefore] = useState(DEFAULT_CONTEXT_BEFORE);
  const [contextAfter, setContextAfter] = useState(DEFAULT_CONTEXT_AFTER);

  const activeScheme = useMemo(
    () => CODING_SCHEMES.find((sc) => sc.id === schemeId) ?? null,
    [schemeId],
  );

  const schemeName =
    activeScheme?.label ?? (schemeId === "custom" ? "Custom" : "");

  const categoryColorMap = useMemo(
    () => buildColorMap(activeScheme, categories),
    [activeScheme, categories],
  );

  // ── Handlers ──

  const setSchemeId = useCallback(
    (id: string) => {
      setSchemeIdState(id);
      const scheme = CODING_SCHEMES.find((sc) => sc.id === id);
      if (!scheme) return;
      const opts = { segmentation, outputType, scale, perSpeaker };
      setCategoriesState(schemeCategories(scheme, opts));
      setCategoriesDirty(false);
      setSystemPromptState(scheme.defaultPrompt(opts));
      setPromptDirty(false);
    },
    [segmentation, outputType, scale, perSpeaker],
  );

  // Changing segmentation or output type changes the task wording, so the
  // default prompt is regenerated, and so are the categories when the scheme
  // words them per mode. Either is guarded by a confirm when the user has
  // hand-edited it. Scale/anchor and window changes do NOT touch the prompt
  // (anchors are appended at request time), so they skip this.
  const regenerateDefaultPrompt = useCallback(
    (
      nextSeg: SegmentationStrategy,
      nextOut: OutputType,
      nextPerSpeaker: boolean = perSpeaker,
    ): boolean => {
      const scheme = CODING_SCHEMES.find((sc) => sc.id === schemeId);
      const opts = {
        segmentation: nextSeg,
        outputType: nextOut,
        scale,
        perSpeaker: nextPerSpeaker,
      };
      const nextCategories = scheme ? schemeCategories(scheme, opts) : null;
      const categoriesChange =
        nextCategories !== null && !sameCategories(nextCategories, categories);
      const losesPrompt = promptDirty;
      const losesCategories = categoriesChange && categoriesDirty;
      if ((losesPrompt || losesCategories) && typeof window !== "undefined") {
        const what =
          losesPrompt && losesCategories
            ? "prompt and category edits"
            : losesPrompt
              ? "prompt edits"
              : "category edits";
        const ok = window.confirm(
          `Changing this will reset your ${what} to the new defaults. Continue?`,
        );
        if (!ok) return false;
      }
      if (scheme) {
        setSystemPromptState(scheme.defaultPrompt(opts));
        setPromptDirty(false);
      }
      if (nextCategories && categoriesChange) {
        setCategoriesState(nextCategories);
        setCategoriesDirty(false);
      }
      return true;
    },
    [promptDirty, categoriesDirty, categories, schemeId, scale, perSpeaker],
  );

  const setSegmentation = useCallback(
    (next: SegmentationStrategy) => {
      if (next === segmentation) return;
      if (!regenerateDefaultPrompt(next, outputType)) return;
      setSegmentationState(next);
    },
    [segmentation, outputType, regenerateDefaultPrompt],
  );

  const setOutputType = useCallback(
    (next: OutputType) => {
      if (next === outputType) return;
      if (!regenerateDefaultPrompt(segmentation, next)) return;
      setOutputTypeState(next);
    },
    [segmentation, outputType, regenerateDefaultPrompt],
  );

  const setScale = useCallback((next: RatingScale) => {
    setScaleState(next);
  }, []);

  const setWindowSeconds = useCallback((n: number) => {
    setWindowSecondsState(n);
  }, []);

  const setBatchSize = useCallback((n: number) => {
    setBatchSizeState(Number.isFinite(n) ? Math.max(1, Math.floor(n)) : 1);
  }, []);

  const setPerSpeaker = useCallback(
    (next: boolean) => {
      if (next === perSpeaker) return;
      // Only time mode uses this flag, so only then does the default prompt
      // wording change — reuse the confirm-on-dirty regeneration path.
      if (segmentation === "time") {
        if (!regenerateDefaultPrompt(segmentation, outputType, next)) return;
      }
      setPerSpeakerState(next);
    },
    [perSpeaker, segmentation, outputType, regenerateDefaultPrompt],
  );

  const setSystemPrompt = useCallback((v: string) => {
    setSystemPromptState(v);
    setPromptDirty(true);
  }, []);

  const resetPrompt = useCallback(() => {
    const scheme = CODING_SCHEMES.find((sc) => sc.id === schemeId);
    if (!scheme) return;
    setSystemPromptState(
      scheme.defaultPrompt({ segmentation, outputType, scale, perSpeaker }),
    );
    setPromptDirty(false);
  }, [schemeId, segmentation, outputType, scale, perSpeaker]);

  const setCategories = useCallback(
    (next: CategoryDefinition[]) => {
      setCategoriesState(next);
      const scheme = CODING_SCHEMES.find((sc) => sc.id === schemeId);
      if (scheme) {
        const defaults = schemeCategories(scheme, {
          segmentation,
          outputType,
          scale,
          perSpeaker,
        });
        setCategoriesDirty(!sameCategories(next, defaults));
      } else {
        setCategoriesDirty(true);
      }
    },
    [schemeId, segmentation, outputType, scale, perSpeaker],
  );

  const resetCategories = useCallback(() => {
    const scheme = CODING_SCHEMES.find((sc) => sc.id === schemeId);
    if (!scheme) return;
    setCategoriesState(
      schemeCategories(scheme, { segmentation, outputType, scale, perSpeaker }),
    );
    setCategoriesDirty(false);
  }, [schemeId, segmentation, outputType, scale, perSpeaker]);

  // Hydration writes the raw state directly: the saved prompt is already the
  // user's own text, so the confirm-on-dirty path must not run here.
  const restoreSettings = useCallback((parsed: PersistedSession) => {
    setSchemeIdState(parsed.schemeId);
    setSegmentationState(parsed.segmentation);
    setOutputTypeState(parsed.outputType);
    setScaleState(parsed.scale);
    setWindowSecondsState(parsed.windowSeconds);
    setPerSpeakerState(parsed.perSpeaker);
    setBatchSizeState(parsed.batchSize);
    setCategoriesState(parsed.categories);
    setCategoriesDirty(parsed.categoriesDirty);
    setSystemPromptState(parsed.systemPrompt);
    setPromptDirty(parsed.promptDirty);
    setContextBefore(parsed.contextBefore);
    setContextAfter(parsed.contextAfter);
  }, []);

  return {
    schemeId,
    activeScheme,
    categories,
    categoriesDirty,
    segmentation,
    outputType,
    scale,
    windowSeconds,
    perSpeaker,
    batchSize,
    systemPrompt,
    promptDirty,
    contextBefore,
    contextAfter,
    setSchemeId,
    setSegmentation,
    setOutputType,
    setScale,
    setWindowSeconds,
    setPerSpeaker,
    setBatchSize,
    setCategories,
    resetCategories,
    setSystemPrompt,
    resetPrompt,
    setContextBefore,
    setContextAfter,

    schemeName,
    categoryColorMap,

    restoreSettings,
  };
}
