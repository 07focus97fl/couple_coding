"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ApiLog,
  AudioFileEntry,
  CategoryDefinition,
  CodedUnit,
  CodingScheme,
  COLUMN_DEFINITIONS,
  DEFAULT_CONTEXT_WINDOW,
  DEFAULT_GRANULARITY,
  Granularity,
  RawTranscript,
  SpeakingTurn,
  TranscriptFile,
} from "@/lib/types";
import { CODING_SCHEMES } from "@/lib/coding-schemes";
import { alignUtteranceToWords, getTurnWords } from "@/lib/align-utterances";
import { parseTranscript } from "@/lib/parse-transcript";
import { generateCsv } from "@/lib/generate-csv";
import { DEFAULT_MODEL_ID, getModel } from "@/lib/models";
import { buildColorMap } from "@/lib/category-colors";
import {
  AUTOSAVE_KEY,
  deserialize,
  PersistedSession,
  UploadMode,
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
  const turnWords = getTurnWords(file.rawTranscript, parentTurn);
  const aligned = alignUtteranceToWords(unit.text, turnWords);
  if (aligned.ok) {
    return { ...unit, startTime: aligned.startTime, endTime: aligned.endTime };
  }
  return { ...unit, approximateTiming: true };
}

export function sortUnits(units: CodedUnit[]): CodedUnit[] {
  return [...units].sort((a, b) => {
    if (a.turnNumber !== b.turnNumber) return a.turnNumber - b.turnNumber;
    const au = a.utteranceIndex ?? 0;
    const bu = b.utteranceIndex ?? 0;
    return au - bu;
  });
}

export interface CodingSession {
  // Upload
  uploadMode: UploadMode;
  files: TranscriptFile[];
  audioFiles: AudioFileEntry[];
  dragOver: boolean;
  uploadError: string | null;
  setUploadMode: (m: UploadMode) => void;
  setDragOver: (b: boolean) => void;
  processFiles: (fl: FileList) => Promise<void>;
  processAudioInput: (fl: FileList) => void;
  removeFile: (id: string) => void;
  removeAudioFile: (id: string) => void;
  toggleFile: (id: string) => void;
  transcribeAudio: (id: string) => Promise<void>;
  transcribeAllPending: () => Promise<void>;
  isAnyTranscribing: boolean;
  pendingAudioCount: number;

  // Auth / model
  selectedModel: string;
  setSelectedModel: (id: string) => void;
  apiKey: string;
  setApiKey: (k: string) => void;
  showKey: boolean;
  setShowKey: (b: boolean) => void;
  elevenLabsKey: string;
  setElevenLabsKey: (k: string) => void;
  showElevenKey: boolean;
  setShowElevenKey: (b: boolean) => void;
  devSignedIn: boolean;
  devPassword: string;
  devAuthError: string;
  setDevPassword: (s: string) => void;
  handleDevSignIn: () => Promise<void>;
  handleDevSignOut: () => void;

  // Scheme + prompt
  schemeId: string | null;
  activeScheme: CodingScheme | null;
  categories: CategoryDefinition[];
  categoriesDirty: boolean;
  granularity: Granularity;
  systemPrompt: string;
  promptDirty: boolean;
  contextWindow: number;
  setSchemeId: (id: string) => void;
  setGranularity: (g: Granularity) => void;
  setCategories: (c: CategoryDefinition[]) => void;
  resetCategories: () => void;
  setSystemPrompt: (v: string) => void;
  resetPrompt: () => void;
  setContextWindow: (n: number) => void;

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
  tweaksOpen: boolean;
  setTweaksOpen: (b: boolean) => void;
  activeSectionId: string | null;

  // Autosave
  autosaveState: AutosaveState;
}

export function useCodingSession(): CodingSession {
  const [uploadMode, setUploadMode] = useState<UploadMode>("transcript");
  const [files, setFiles] = useState<TranscriptFile[]>([]);
  const [audioFiles, setAudioFiles] = useState<AudioFileEntry[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [apiKey, setApiKeyState] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [elevenLabsKey, setElevenLabsKeyState] = useState("");
  const [showElevenKey, setShowElevenKey] = useState(false);
  const audioAbortersRef = useRef<Map<string, AbortController>>(new Map());
  const [devSignedIn, setDevSignedIn] = useState(false);
  const [devPassword, setDevPasswordState] = useState("");
  const [devAuthError, setDevAuthError] = useState("");
  const [apiLogs, setApiLogs] = useState<ApiLog[]>([]);
  const [selectedModel, setSelectedModel] = useState(DEFAULT_MODEL_ID);
  const [schemeId, setSchemeIdState] = useState<string | null>(null);
  const [granularity, setGranularityState] = useState<Granularity>(
    DEFAULT_GRANULARITY,
  );
  const [categories, setCategoriesState] = useState<CategoryDefinition[]>([]);
  const [categoriesDirty, setCategoriesDirty] = useState(false);
  const [systemPrompt, setSystemPromptState] = useState("");
  const [promptDirty, setPromptDirty] = useState(false);
  const [contextWindow, setContextWindow] = useState(DEFAULT_CONTEXT_WINDOW);
  const [openResults, setOpenResults] = useState<Record<string, boolean>>({});
  const [runStartedAt, setRunStartedAt] = useState<number | null>(null);
  const [tweaksOpen, setTweaksOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const activeSectionId = useScrollSpy(
    SECTION_IDS as readonly string[] as string[],
  );

  useEffect(() => {
    const storedKey = localStorage.getItem("anthropic_api_key");
    if (storedKey) setApiKeyState(storedKey);
    const storedEleven = localStorage.getItem("elevenlabs_api_key");
    if (storedEleven) setElevenLabsKeyState(storedEleven);
    if (localStorage.getItem("dev_signed_in") === "true") setDevSignedIn(true);

    try {
      const raw = localStorage.getItem(AUTOSAVE_KEY);
      if (raw) {
        const parsed = deserialize(raw);
        if (parsed) {
          setUploadMode(parsed.uploadMode);
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
              })),
          );
          if (parsed.selectedModel) setSelectedModel(parsed.selectedModel);
          setSchemeIdState(parsed.schemeId);
          setGranularityState(parsed.granularity);
          setCategoriesState(parsed.categories);
          setCategoriesDirty(parsed.categoriesDirty);
          setSystemPromptState(parsed.systemPrompt);
          setPromptDirty(parsed.promptDirty);
          setContextWindow(parsed.contextWindow);
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

  const hasFiles = files.length > 0;
  const isAnyCoding = files.some((f) => f.status === "coding");
  const anySelected = files.some((f) => f.selected);
  const selectedFiles = useMemo(
    () => files.filter((f) => f.selected),
    [files],
  );

  const isAnyTranscribing = audioFiles.some(
    (e) => e.status === "transcribing",
  );
  const pendingAudioCount = audioFiles.filter(
    (e) => e.status === "pending",
  ).length;

  const activeScheme = useMemo(
    () => CODING_SCHEMES.find((sc) => sc.id === schemeId) ?? null,
    [schemeId],
  );

  const modelName = useMemo(() => {
    return getModel(selectedModel)?.name ?? "";
  }, [selectedModel]);

  const schemeName =
    activeScheme?.label ?? (schemeId === "custom" ? "Custom" : "");

  const stepDone: [boolean, boolean, boolean, boolean] = [
    hasFiles,
    selectedModel !== "" && (apiKey !== "" || devSignedIn),
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
      version: 2,
      uploadMode,
      files: files.map((f) => ({
        id: f.id,
        fileName: f.fileName,
        rawTranscript: f.rawTranscript,
        selected: f.selected,
      })),
      selectedModel,
      schemeId,
      granularity,
      categories,
      categoriesDirty,
      systemPrompt,
      promptDirty,
      contextWindow,
    };
  }, [
    hydrated,
    uploadMode,
    files,
    selectedModel,
    schemeId,
    granularity,
    categories,
    categoriesDirty,
    systemPrompt,
    promptDirty,
    contextWindow,
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
    selectedModel,
    isAnyCoding,
  );

  // ── Handlers ──

  const setApiKey = useCallback((val: string) => {
    setApiKeyState(val);
    if (val) localStorage.setItem("anthropic_api_key", val);
    else localStorage.removeItem("anthropic_api_key");
  }, []);

  const setElevenLabsKey = useCallback((val: string) => {
    setElevenLabsKeyState(val);
    if (val) localStorage.setItem("elevenlabs_api_key", val);
    else localStorage.removeItem("elevenlabs_api_key");
  }, []);

  const setDevPassword = useCallback((s: string) => {
    setDevPasswordState(s);
    setDevAuthError("");
  }, []);

  const handleDevSignIn = useCallback(async () => {
    setDevAuthError("");
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: devPassword }),
      });
      if (res.ok) {
        localStorage.setItem("dev_signed_in", "true");
        setDevSignedIn(true);
        setDevPasswordState("");
      } else {
        setDevAuthError("Wrong password");
      }
    } catch {
      setDevAuthError("Auth request failed");
    }
  }, [devPassword]);

  const handleDevSignOut = useCallback(() => {
    localStorage.removeItem("dev_signed_in");
    setDevSignedIn(false);
    setDevPasswordState("");
    setDevAuthError("");
  }, []);

  const processFiles = useCallback(async (fileList: FileList) => {
    setUploadError(null);
    try {
      const results = await Promise.all(Array.from(fileList).map(readJsonFile));
      const newFiles: TranscriptFile[] = results.map((f) => {
        const parsedTurns = parseTranscript(f.transcript.words);
        return {
          id: crypto.randomUUID(),
          fileName: f.fileName,
          rawTranscript: f.transcript,
          turns: parsedTurns,
          codedUnits: [],
          selected: true,
          status: "pending" as const,
          progress: { completed: 0, total: parsedTurns.length },
        };
      });
      setFiles((prev) => [...prev, ...newFiles]);
    } catch (err) {
      setUploadError(
        err instanceof Error ? err.message : "Failed to read files.",
      );
    }
  }, []);

  const processAudioInput = useCallback((fileList: FileList) => {
    setUploadError(null);
    const added = Array.from(fileList).filter((f) =>
      /\.(mp3|mp4|wav)$/i.test(f.name),
    );
    if (added.length === 0) {
      setUploadError("Only MP3, MP4, or WAV files are accepted.");
      return;
    }
    const entries: AudioFileEntry[] = added.map((file) => ({
      id: crypto.randomUUID(),
      file,
      status: "pending" as const,
    }));
    setAudioFiles((prev) => [...prev, ...entries]);
  }, []);

  const removeFile = useCallback((id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  }, []);

  const removeAudioFile = useCallback((id: string) => {
    const aborter = audioAbortersRef.current.get(id);
    if (aborter) {
      aborter.abort();
      audioAbortersRef.current.delete(id);
    }
    setAudioFiles((prev) => prev.filter((e) => e.id !== id));
  }, []);

  const transcribeAudio = useCallback(async () => {
    // Stub — ElevenLabs transcription not yet wired up.
  }, []);

  const transcribeAllPending = useCallback(async () => {
    // Stub — ElevenLabs transcription not yet wired up.
  }, []);

  const toggleFile = useCallback((id: string) => {
    setFiles((prev) =>
      prev.map((f) => (f.id === id ? { ...f, selected: !f.selected } : f)),
    );
  }, []);

  const setSchemeId = useCallback(
    (id: string) => {
      setSchemeIdState(id);
      const scheme = CODING_SCHEMES.find((sc) => sc.id === id);
      if (!scheme) return;
      setCategoriesState(scheme.categories);
      setCategoriesDirty(false);
      setSystemPromptState(scheme.defaultPrompt(granularity));
      setPromptDirty(false);
    },
    [granularity],
  );

  const setGranularity = useCallback(
    (next: Granularity) => {
      if (next === granularity) return;
      const scheme =
        CODING_SCHEMES.find((sc) => sc.id === schemeId) ?? null;

      if (promptDirty && typeof window !== "undefined") {
        const ok = window.confirm(
          "Switching granularity will reset your prompt edits to the new default. Continue?",
        );
        if (!ok) return;
      }

      setGranularityState(next);
      if (scheme) {
        setSystemPromptState(scheme.defaultPrompt(next));
        setPromptDirty(false);
      }
    },
    [granularity, schemeId, promptDirty],
  );

  const setSystemPrompt = useCallback((v: string) => {
    setSystemPromptState(v);
    setPromptDirty(true);
  }, []);

  const resetPrompt = useCallback(() => {
    const scheme = CODING_SCHEMES.find((sc) => sc.id === schemeId);
    if (!scheme) return;
    setSystemPromptState(scheme.defaultPrompt(granularity));
    setPromptDirty(false);
  }, [schemeId, granularity]);

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
      const turns =
        file.turns.length > 0
          ? file.turns
          : parseTranscript(file.rawTranscript.words);

      setFiles((prev) =>
        prev.map((f) =>
          f.id === file.id
            ? {
                ...f,
                turns,
                status: "coding" as const,
                codedUnits: [],
                error: undefined,
                progress: { completed: 0, total: turns.length },
              }
            : f,
        ),
      );

      try {
        const response = await fetch("/api/code", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            turns,
            model: selectedModel,
            granularity,
            categories,
            systemPrompt,
            contextWindow,
            ...(devSignedIn ? {} : { apiKey }),
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
    granularity,
    categories,
    systemPrompt,
    contextWindow,
    devSignedIn,
    apiKey,
  ]);

  const doneFiles = useMemo(
    () =>
      files.filter(
        (f) => f.selected && f.status === "done" && f.codedUnits.length > 0,
      ),
    [files],
  );

  const handleExportAll = useCallback(() => {
    const fileHeader = "File";
    const colHeaders = COLUMN_DEFINITIONS.map((c) => c.csvHeader);
    const header = [fileHeader, ...colHeaders].join(",");

    const rows: string[] = [];
    for (const f of doneFiles) {
      const sorted = sortUnits(f.codedUnits);
      const csv = generateCsv(sorted);
      const csvLines = csv.split("\n").slice(1);
      for (const line of csvLines) {
        const escapedName =
          f.fileName.includes(",") || f.fileName.includes('"')
            ? `"${f.fileName.replace(/"/g, '""')}"`
            : f.fileName;
        rows.push(`${escapedName},${line}`);
      }
    }

    const blob = new Blob([[header, ...rows].join("\n")], {
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
    uploadMode,
    files,
    audioFiles,
    dragOver,
    uploadError,
    setUploadMode,
    setDragOver,
    processFiles,
    processAudioInput,
    removeFile,
    removeAudioFile,
    toggleFile,
    transcribeAudio,
    transcribeAllPending,
    isAnyTranscribing,
    pendingAudioCount,

    selectedModel,
    setSelectedModel,
    apiKey,
    setApiKey,
    showKey,
    setShowKey,
    elevenLabsKey,
    setElevenLabsKey,
    showElevenKey,
    setShowElevenKey,
    devSignedIn,
    devPassword,
    devAuthError,
    setDevPassword,
    handleDevSignIn,
    handleDevSignOut,

    schemeId,
    activeScheme,
    categories,
    categoriesDirty,
    granularity,
    systemPrompt,
    promptDirty,
    contextWindow,
    setSchemeId,
    setGranularity,
    setCategories,
    resetCategories,
    setSystemPrompt,
    resetPrompt,
    setContextWindow,

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

    tweaksOpen,
    setTweaksOpen,
    activeSectionId,

    autosaveState,
  };
}
