"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ApiLog,
  CategoryDefinition,
  CodedUnit,
  CodingScheme,
  CodingMode,
  DEFAULT_CONTEXT_BEFORE,
  DEFAULT_CONTEXT_AFTER,
  DEFAULT_OUTPUT_TYPE,
  DEFAULT_SCALE,
  DEFAULT_SEGMENTATION,
  DEFAULT_WINDOW_SECONDS,
  DEFAULT_BATCH_SIZE,
  Granularity,
  OutputType,
  RatingScale,
  RawTranscript,
  SegmentationStrategy,
  SpeakingTurn,
  TranscriptFile,
} from "@/lib/types";
import { CODING_SCHEMES } from "@/lib/coding-schemes";
import { alignUtteranceToWords, getTurnWords } from "@/lib/align-utterances";
import { parseTranscript } from "@/lib/parse-transcript";
import { segment } from "@/lib/segment";
import { generateCsv, dimsFromUnits } from "@/lib/generate-csv";
import {
  DEFAULT_REASONING_LEVEL,
  getModel,
  type ProviderId,
  type ReasoningLevel,
} from "@/lib/models";
import { buildColorMap } from "@/lib/category-colors";
import {
  AUTOSAVE_KEY,
  deserialize,
  PersistedSession,
} from "@/lib/autosave-schema";
import { useAutosave, AutosaveState } from "./useAutosave";
import { useRunStats, RunStats } from "./useRunStats";
import { useScrollSpy } from "./useScrollSpy";

export const SECTION_IDS = [
  "s-upload",
  "s-model",
  "s-scheme",
  "s-run",
] as const;
export type SectionId = (typeof SECTION_IDS)[number];

// VTCS is the flagship scheme; a fresh session boots with it selected and its
// categories/prompt populated. The autosave hydration effect overrides these
// for returning users, so this only affects first-time / cleared sessions.
const DEFAULT_SCHEME_ID = "vtcs";
const DEFAULT_SCHEME =
  CODING_SCHEMES.find((sc) => sc.id === DEFAULT_SCHEME_ID) ?? null;

const ELEVENLABS_MODEL_ID = "scribe_v1";

function readJsonFile(
  file: File,
): Promise<{ fileName: string; transcript: RawTranscript }> {
  return new Promise((resolve, reject) => {
    if (!file.name.endsWith(".json")) {
      reject(new Error(`"${file.name}" is not a JSON file.`));
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string) as RawTranscript;
        if (!data.words || !Array.isArray(data.words)) {
          reject(new Error(`"${file.name}": missing 'words' array.`));
          return;
        }
        resolve({ fileName: file.name, transcript: data });
      } catch {
        reject(new Error(`"${file.name}": failed to parse JSON.`));
      }
    };
    reader.readAsText(file);
  });
}

function alignIncomingUnit(
  unit: CodedUnit,
  file: TranscriptFile,
  turns: SpeakingTurn[],
  granularity: Granularity,
): CodedUnit {
  if (granularity !== "utterance" || unit.utteranceIndex === undefined) {
    return unit;
  }
  const parentTurn = turns.find((t) => t.turnNumber === unit.turnNumber);
  if (!parentTurn) return unit;
  if (!file.rawTranscript) return unit;
  const turnWords = getTurnWords(file.rawTranscript, parentTurn);
  const aligned = alignUtteranceToWords(unit.text, turnWords);
  if (aligned.ok) {
    return { ...unit, startTime: aligned.startTime, endTime: aligned.endTime };
  }
  return { ...unit, approximateTiming: true };
}

export function sortUnits(units: CodedUnit[]): CodedUnit[] {
  return [...units].sort((a, b) => {
    // Time windows have no turnNumber — order those by start time.
    if (a.turnNumber === undefined || b.turnNumber === undefined) {
      if (a.startTime !== b.startTime) return a.startTime - b.startTime;
    } else if (a.turnNumber !== b.turnNumber) {
      return a.turnNumber - b.turnNumber;
    }
    const au = a.utteranceIndex ?? 0;
    const bu = b.utteranceIndex ?? 0;
    return au - bu;
  });
}

export interface CodingSession {
  // Upload
  files: TranscriptFile[];
  dragOver: boolean;
  uploadError: string | null;
  setDragOver: (b: boolean) => void;
  processFiles: (fl: FileList) => Promise<void>;
  removeFile: (id: string) => void;
  toggleFile: (id: string) => void;
  setFileTopic: (id: string, topic: string) => void;
  transcribeAudio: (id: string) => Promise<void>;
  transcribeAllPending: () => Promise<void>;
  downloadRawTranscript: (fileId: string) => void;
  isAnyTranscribing: boolean;
  pendingAudioCount: number;

  // Auth / model
  selectedModel: string;
  setSelectedModel: (id: string) => void;
  reasoningLevel: ReasoningLevel;
  setReasoningLevel: (l: ReasoningLevel) => void;
  apiKey: string;
  setApiKey: (k: string) => void;
  openaiKey: string;
  setOpenaiKey: (k: string) => void;
  googleKey: string;
  setGoogleKey: (k: string) => void;
  showKey: boolean;
  setShowKey: (b: boolean) => void;
  // Derived from the selected model: its provider and the matching key.
  activeProvider: ProviderId;
  activeProviderKey: string;
  setActiveProviderKey: (k: string) => void;
  elevenLabsKey: string;
  setElevenLabsKey: (k: string) => void;
  showElevenKey: boolean;
  setShowElevenKey: (b: boolean) => void;

  // Scheme + prompt
  schemeId: string | null;
  activeScheme: CodingScheme | null;
  categories: CategoryDefinition[];
  categoriesDirty: boolean;
  granularity: Granularity;
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
  setGranularity: (g: Granularity) => void;
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

  // Run
  apiLogs: ApiLog[];
  isAnyCoding: boolean;
  anySelected: boolean;
  runCoding: () => Promise<void>;
  handleExportAll: () => void;
  openResults: Record<string, boolean>;
  toggleResultsOpen: (fileId: string) => void;

  // Derived
  hasFiles: boolean;
  stepDone: [boolean, boolean, boolean, boolean];
  selectedFiles: TranscriptFile[];
  totalTurns: number;
  completedTurns: number;
  allCodedUnits: CodedUnit[];
  categoryColorMap: Record<string, string>;
  runStartedAt: number | null;
  runStats: RunStats;
  modelName: string;
  schemeName: string;
  doneFiles: TranscriptFile[];

  // UI
  activeSectionId: string | null;

  // Autosave
  autosaveState: AutosaveState;
}

export function useCodingSession(): CodingSession {
  const [files, setFiles] = useState<TranscriptFile[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [apiKey, setApiKeyState] = useState("");
  const [openaiKey, setOpenaiKeyState] = useState("");
  const [googleKey, setGoogleKeyState] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [elevenLabsKey, setElevenLabsKeyState] = useState("");
  const [showElevenKey, setShowElevenKey] = useState(false);
  const audioAbortersRef = useRef<Map<string, AbortController>>(new Map());
  const filesRef = useRef<TranscriptFile[]>([]);
  const [apiLogs, setApiLogs] = useState<ApiLog[]>([]);
  // Empty until the user explicitly picks a model — nothing is preselected, so the
  // API-key field only appears once a provider is chosen.
  const [selectedModel, setSelectedModel] = useState("");
  const [reasoningLevel, setReasoningLevel] = useState<ReasoningLevel>(
    DEFAULT_REASONING_LEVEL,
  );
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
  // granularity (turn | utterance) is the categorical-era view of segmentation.
  const granularity: Granularity =
    segmentation === "utterance" ? "utterance" : "turn";
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
  const [openResults, setOpenResults] = useState<Record<string, boolean>>({});
  const [runStartedAt, setRunStartedAt] = useState<number | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const activeSectionId = useScrollSpy(
    SECTION_IDS as readonly string[] as string[],
  );

  useEffect(() => {
    const storedKey = localStorage.getItem("anthropic_api_key");
    if (storedKey) setApiKeyState(storedKey);
    const storedOpenai = localStorage.getItem("openai_api_key");
    if (storedOpenai) setOpenaiKeyState(storedOpenai);
    const storedGoogle = localStorage.getItem("google_api_key");
    if (storedGoogle) setGoogleKeyState(storedGoogle);
    const storedEleven = localStorage.getItem("elevenlabs_api_key");
    if (storedEleven) setElevenLabsKeyState(storedEleven);

    try {
      const raw = localStorage.getItem(AUTOSAVE_KEY);
      if (raw) {
        const parsed = deserialize(raw);
        if (parsed) {
          setFiles(
            parsed.files
              .filter((f) => f.rawTranscript !== null)
              .map((f) => ({
                id: f.id,
                fileName: f.fileName,
                rawTranscript: f.rawTranscript as RawTranscript,
                turns: [],
                codedUnits: [],
                selected: f.selected,
                status: "pending" as const,
                progress: { completed: 0, total: 0 },
                topic: f.topic ?? "",
              })),
          );
          if (parsed.selectedModel) {
            // Guard against stale/removed model IDs in old saved sessions —
            // clear the selection rather than restoring a dead ID.
            const restored = getModel(parsed.selectedModel);
            setSelectedModel(
              restored && !restored.comingSoon ? parsed.selectedModel : "",
            );
          }
          setReasoningLevel(parsed.reasoningLevel ?? DEFAULT_REASONING_LEVEL);
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
        }
      }
    } catch {
      /* corrupt — discard */
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (apiLogs.length > 0) {
      sessionStorage.setItem("api_logs", JSON.stringify(apiLogs));
    }
  }, [apiLogs]);

  useEffect(() => {
    filesRef.current = files;
  }, [files]);

  const hasFiles = files.length > 0;
  const isAnyCoding = files.some((f) => f.status === "coding");
  const anySelected = files.some((f) => f.selected);
  const selectedFiles = useMemo(
    () => files.filter((f) => f.selected),
    [files],
  );

  const isAnyTranscribing = files.some(
    (f) => f.transcribeStatus === "transcribing",
  );
  const pendingAudioCount = files.filter(
    (f) => f.transcribeStatus === "pending",
  ).length;

  const activeScheme = useMemo(
    () => CODING_SCHEMES.find((sc) => sc.id === schemeId) ?? null,
    [schemeId],
  );

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
      : apiKey;

  const schemeName =
    activeScheme?.label ?? (schemeId === "custom" ? "Custom" : "");

  const stepDone: [boolean, boolean, boolean, boolean] = [
    hasFiles,
    selectedModel !== "" && activeProviderKey !== "",
    schemeId !== null,
    anySelected &&
      selectedFiles.length > 0 &&
      selectedFiles.every((f) => f.status === "done"),
  ];

  const allCodedUnits = useMemo(
    () => selectedFiles.flatMap((f) => f.codedUnits),
    [selectedFiles],
  );

  const categoryColorMap = useMemo(
    () => buildColorMap(activeScheme, categories),
    [activeScheme, categories],
  );

  const totalTurns = selectedFiles.reduce((s, f) => s + f.progress.total, 0);
  const completedTurns = selectedFiles.reduce(
    (s, f) => s + f.progress.completed,
    0,
  );

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

  const autosaveState = useAutosave(
    persistedSession,
    hydrated && !isAnyCoding,
  );

  const runStats = useRunStats(
    apiLogs,
    runStartedAt,
    totalTurns,
    completedTurns,
    isAnyCoding,
  );

  // ── Handlers ──

  const setApiKey = useCallback((val: string) => {
    setApiKeyState(val);
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

  // Writes whichever provider key matches the currently-selected model.
  const setActiveProviderKey = useCallback(
    (val: string) => {
      if (activeProvider === "openai") setOpenaiKey(val);
      else if (activeProvider === "google") setGoogleKey(val);
      else setApiKey(val);
    },
    [activeProvider, setOpenaiKey, setGoogleKey, setApiKey],
  );

  const setElevenLabsKey = useCallback((val: string) => {
    setElevenLabsKeyState(val);
    if (val) localStorage.setItem("elevenlabs_api_key", val);
    else localStorage.removeItem("elevenlabs_api_key");
  }, []);

  const processFiles = useCallback(async (fileList: FileList) => {
    setUploadError(null);
    const incoming = Array.from(fileList);
    const errors: string[] = [];
    const newFiles: TranscriptFile[] = [];

    for (const file of incoming) {
      const lower = file.name.toLowerCase();
      if (lower.endsWith(".json")) {
        try {
          const { transcript } = await readJsonFile(file);
          const parsedTurns = parseTranscript(transcript.words);
          newFiles.push({
            id: crypto.randomUUID(),
            fileName: file.name,
            rawTranscript: transcript,
            turns: parsedTurns,
            codedUnits: [],
            selected: true,
            status: "pending",
            progress: { completed: 0, total: parsedTurns.length },
            topic: "",
          });
        } catch (err) {
          errors.push(
            err instanceof Error ? err.message : `Failed to read "${file.name}".`,
          );
        }
      } else if (/\.(mp3|mp4|wav)$/i.test(lower)) {
        newFiles.push({
          id: crypto.randomUUID(),
          fileName: file.name,
          rawTranscript: null,
          turns: [],
          codedUnits: [],
          selected: false,
          status: "pending",
          progress: { completed: 0, total: 0 },
          audioSource: file,
          transcribeStatus: "pending",
          topic: "",
        });
      } else {
        errors.push(
          `"${file.name}": unsupported file type. Use JSON, MP3, MP4, or WAV.`,
        );
      }
    }

    if (newFiles.length > 0) setFiles((prev) => [...prev, ...newFiles]);
    if (errors.length > 0) setUploadError(errors.join(" "));
  }, []);

  const removeFile = useCallback((id: string) => {
    const aborter = audioAbortersRef.current.get(id);
    if (aborter) {
      aborter.abort();
      audioAbortersRef.current.delete(id);
    }
    setFiles((prev) => prev.filter((f) => f.id !== id));
  }, []);

  const transcribeAudio = useCallback(
    async (id: string) => {
      const target = filesRef.current.find((f) => f.id === id);
      if (!target?.audioSource) return;
      if (
        target.transcribeStatus !== "pending" &&
        target.transcribeStatus !== "error"
      ) {
        return;
      }

      setFiles((prev) =>
        prev.map((f) =>
          f.id === id
            ? {
                ...f,
                transcribeStatus: "transcribing",
                transcribeError: undefined,
              }
            : f,
        ),
      );

      const controller = new AbortController();
      audioAbortersRef.current.set(id, controller);

      try {
        const formData = new FormData();
        formData.append("file", target.audioSource);
        formData.append("model_id", ELEVENLABS_MODEL_ID);
        formData.append("diarize", "true");
        formData.append("num_speakers", "2");
        formData.append("timestamps_granularity", "word");
        formData.append("tag_audio_events", "false");

        const headers: Record<string, string> = {};
        if (elevenLabsKey) {
          headers["x-elevenlabs-key"] = elevenLabsKey;
        }

        const response = await fetch("/api/transcribe", {
          method: "POST",
          body: formData,
          headers,
          signal: controller.signal,
        });

        if (!response.ok) {
          const body = await response.json().catch(() => ({}));
          throw new Error(
            body.error || `Transcription failed (${response.status})`,
          );
        }

        const data = (await response.json()) as RawTranscript;
        if (!Array.isArray(data.words) || data.words.length === 0) {
          throw new Error("ElevenLabs returned no word-level data.");
        }

        const turns = parseTranscript(data.words);

        setFiles((prev) =>
          prev.map((f) =>
            f.id === id
              ? {
                  ...f,
                  rawTranscript: data,
                  turns,
                  selected: true,
                  status: "pending",
                  progress: { completed: 0, total: turns.length },
                  transcribeStatus: "done",
                  transcribeError: undefined,
                }
              : f,
          ),
        );
      } catch (err) {
        const message =
          err instanceof Error
            ? err.name === "AbortError"
              ? "Cancelled"
              : err.message
            : "Transcription failed";
        setFiles((prev) =>
          prev.map((f) =>
            f.id === id
              ? {
                  ...f,
                  transcribeStatus: "error",
                  transcribeError: message,
                }
              : f,
          ),
        );
      } finally {
        audioAbortersRef.current.delete(id);
      }
    },
    [elevenLabsKey],
  );

  const transcribeAllPending = useCallback(async () => {
    const ids = filesRef.current
      .filter((f) => f.transcribeStatus === "pending")
      .map((f) => f.id);
    for (const id of ids) {
      await transcribeAudio(id);
    }
  }, [transcribeAudio]);

  const downloadRawTranscript = useCallback(
    (fileId: string) => {
      const file = files.find((f) => f.id === fileId);
      if (!file?.rawTranscript) return;

      const blob = new Blob([JSON.stringify(file.rawTranscript, null, 2)], {
        type: "application/json;charset=utf-8;",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const baseName = file.fileName.replace(/\.[^.]+$/, "");
      a.download = `${baseName}.json`;
      a.click();
      URL.revokeObjectURL(url);
    },
    [files],
  );

  const toggleFile = useCallback((id: string) => {
    setFiles((prev) =>
      prev.map((f) => (f.id === id ? { ...f, selected: !f.selected } : f)),
    );
  }, []);

  const setFileTopic = useCallback((id: string, topic: string) => {
    setFiles((prev) =>
      prev.map((f) => (f.id === id ? { ...f, topic } : f)),
    );
  }, []);

  const setSchemeId = useCallback(
    (id: string) => {
      setSchemeIdState(id);
      const scheme = CODING_SCHEMES.find((sc) => sc.id === id);
      if (!scheme) return;
      setCategoriesState(scheme.categories);
      setCategoriesDirty(false);
      setSystemPromptState(
        scheme.defaultPrompt({ segmentation, outputType, scale, perSpeaker }),
      );
      setPromptDirty(false);
    },
    [segmentation, outputType, scale, perSpeaker],
  );

  // Changing segmentation or output type changes the task wording, so the
  // default prompt is regenerated — guarded by a confirm when the user has
  // hand-edited the prompt. Scale/anchor and window changes do NOT touch the
  // prompt (anchors are appended at request time), so they skip this.
  const regenerateDefaultPrompt = useCallback(
    (
      nextSeg: SegmentationStrategy,
      nextOut: OutputType,
      nextPerSpeaker: boolean = perSpeaker,
    ): boolean => {
      if (promptDirty && typeof window !== "undefined") {
        const ok = window.confirm(
          "Changing this will reset your prompt edits to the new default. Continue?",
        );
        if (!ok) return false;
      }
      const scheme = CODING_SCHEMES.find((sc) => sc.id === schemeId);
      if (scheme) {
        setSystemPromptState(
          scheme.defaultPrompt({
            segmentation: nextSeg,
            outputType: nextOut,
            scale,
            perSpeaker: nextPerSpeaker,
          }),
        );
        setPromptDirty(false);
      }
      return true;
    },
    [promptDirty, schemeId, scale, perSpeaker],
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

  // Back-compat alias for the turn/utterance toggle.
  const setGranularity = useCallback(
    (next: Granularity) => setSegmentation(next),
    [setSegmentation],
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
        const sameAsScheme =
          next.length === scheme.categories.length &&
          next.every(
            (c, i) =>
              c.name === scheme.categories[i]?.name &&
              c.description === scheme.categories[i]?.description,
          );
        setCategoriesDirty(!sameAsScheme);
      } else {
        setCategoriesDirty(true);
      }
    },
    [schemeId],
  );

  const resetCategories = useCallback(() => {
    const scheme = CODING_SCHEMES.find((sc) => sc.id === schemeId);
    if (!scheme) return;
    setCategoriesState(scheme.categories);
    setCategoriesDirty(false);
  }, [schemeId]);

  const toggleResultsOpen = useCallback((fileId: string) => {
    setOpenResults((prev) => ({ ...prev, [fileId]: !prev[fileId] }));
  }, []);

  const runCoding = useCallback(async () => {
    if (!hasFiles) return;
    setApiLogs([]);
    setRunStartedAt(Date.now());
    const filesToCode = files.filter((f) => f.selected);

    for (const file of filesToCode) {
      if (!file.rawTranscript) continue;
      const turns =
        file.turns.length > 0
          ? file.turns
          : parseTranscript(file.rawTranscript.words);
      const mode: CodingMode = {
        segmentation,
        outputType,
        scale,
        windowSeconds,
        perSpeaker,
        batchSize,
      };
      const segs = segment(file.rawTranscript.words, mode);

      setFiles((prev) =>
        prev.map((f) =>
          f.id === file.id
            ? {
                ...f,
                turns,
                status: "coding" as const,
                codedUnits: [],
                error: undefined,
                progress: { completed: 0, total: segs.length },
              }
            : f,
        ),
      );

      try {
        const response = await fetch("/api/code", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            segments: segs,
            mode,
            turns,
            model: selectedModel,
            reasoningEffort: reasoningLevel,
            granularity,
            categories,
            systemPrompt,
            contextBefore,
            contextAfter,
            topic: file.topic ?? "",
            apiKey: activeProviderKey,
          }),
        });

        if (!response.ok) {
          const err = await response.json();
          throw new Error(err.error || "Request failed");
        }

        const reader = response.body?.getReader();
        if (!reader) throw new Error("No response stream");

        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          let eventType = "";
          for (const line of lines) {
            if (line.startsWith("event: ")) {
              eventType = line.slice(7);
            } else if (line.startsWith("data: ")) {
              const data = line.slice(6);
              if (eventType === "result") {
                const parsed = JSON.parse(data) as {
                  codedUnit?: CodedUnit;
                  codedTurn?: CodedUnit;
                };
                const incoming = parsed.codedUnit ?? parsed.codedTurn;
                if (incoming) {
                  const aligned = alignIncomingUnit(
                    incoming,
                    file,
                    turns,
                    granularity,
                  );
                  setFiles((prev) =>
                    prev.map((f) =>
                      f.id === file.id
                        ? { ...f, codedUnits: [...f.codedUnits, aligned] }
                        : f,
                    ),
                  );
                }
              } else if (eventType === "progress") {
                const progress = JSON.parse(data);
                setFiles((prev) =>
                  prev.map((f) =>
                    f.id === file.id ? { ...f, progress } : f,
                  ),
                );
              } else if (eventType === "log") {
                const log = JSON.parse(data) as ApiLog;
                log.fileName = file.fileName;
                setApiLogs((prev) => [...prev, log]);
              } else if (eventType === "error") {
                const { message } = JSON.parse(data);
                setFiles((prev) =>
                  prev.map((f) =>
                    f.id === file.id
                      ? { ...f, status: "error" as const, error: message }
                      : f,
                  ),
                );
              }
              eventType = "";
            }
          }
        }

        setFiles((prev) =>
          prev.map((f) =>
            f.id === file.id && f.status !== "error"
              ? { ...f, status: "done" as const }
              : f,
          ),
        );
      } catch (err) {
        setFiles((prev) =>
          prev.map((f) =>
            f.id === file.id
              ? {
                  ...f,
                  status: "error" as const,
                  error:
                    err instanceof Error ? err.message : "Unknown error",
                }
              : f,
          ),
        );
      }
    }
  }, [
    files,
    hasFiles,
    selectedModel,
    reasoningLevel,
    granularity,
    segmentation,
    outputType,
    scale,
    windowSeconds,
    perSpeaker,
    batchSize,
    categories,
    systemPrompt,
    contextBefore,
    contextAfter,
    activeProviderKey,
  ]);

  const doneFiles = useMemo(
    () =>
      files.filter(
        (f) => f.selected && f.status === "done" && f.codedUnits.length > 0,
      ),
    [files],
  );

  const handleExportAll = useCallback(() => {
    const escapeField = (v: string) =>
      v.includes(",") || v.includes('"') || v.includes("\n")
        ? `"${v.replace(/"/g, '""')}"`
        : v;

    const dims = dimsFromUnits(doneFiles.flatMap((f) => f.codedUnits));

    let header: string | null = null;
    const rows: string[] = [];
    for (const f of doneFiles) {
      const sorted = sortUnits(f.codedUnits);
      const csv = generateCsv(sorted, undefined, dims);
      const lines = csv.split("\n");
      if (header === null) header = `File,Topic,${lines[0]}`;
      const escapedName = escapeField(f.fileName);
      const escapedTopic = escapeField(f.topic ?? "");
      for (const line of lines.slice(1)) {
        rows.push(`${escapedName},${escapedTopic},${line}`);
      }
    }

    const blob = new Blob([[header ?? "", ...rows].join("\n")], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "coded_units_all.csv";
    a.click();
    URL.revokeObjectURL(url);
  }, [doneFiles]);

  return {
    files,
    dragOver,
    uploadError,
    setDragOver,
    processFiles,
    removeFile,
    toggleFile,
    setFileTopic,
    transcribeAudio,
    transcribeAllPending,
    downloadRawTranscript,
    isAnyTranscribing,
    pendingAudioCount,

    selectedModel,
    setSelectedModel,
    reasoningLevel,
    setReasoningLevel,
    apiKey,
    setApiKey,
    openaiKey,
    setOpenaiKey,
    googleKey,
    setGoogleKey,
    showKey,
    setShowKey,
    activeProvider,
    activeProviderKey,
    setActiveProviderKey,
    elevenLabsKey,
    setElevenLabsKey,
    showElevenKey,
    setShowElevenKey,

    schemeId,
    activeScheme,
    categories,
    categoriesDirty,
    granularity,
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
    setGranularity,
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

    apiLogs,
    isAnyCoding,
    anySelected,
    runCoding,
    handleExportAll,
    openResults,
    toggleResultsOpen,

    hasFiles,
    stepDone,
    selectedFiles,
    totalTurns,
    completedTurns,
    allCodedUnits,
    categoryColorMap,
    runStartedAt,
    runStats,
    modelName,
    schemeName,
    doneFiles,

    activeSectionId,

    autosaveState,
  };
}
