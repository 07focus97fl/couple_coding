"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ApiLog,
  CategoryDefinition,
  CodedUnit,
  CodingScheme,
  COLUMN_DEFINITIONS,
  DEFAULT_CONTEXT_WINDOW,
  DEFAULT_GRANULARITY,
  Granularity,
  PromptBlockDirty,
  PromptBlockKey,
  PromptBlocks,
  RawTranscript,
  SpeakingTurn,
  TranscriptFile,
} from "@/lib/types";
import { CODING_SCHEMES } from "@/lib/coding-schemes";
import {
  buildDefaultBlocks,
  defaultCategories,
  defaultContextFraming,
  defaultGranularity as defaultGranularityBlock,
  defaultOutputInstruction,
  defaultRole,
  defaultRules,
} from "@/lib/prompt-defaults";
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

export const SECTION_IDS = ["s-upload", "s-model", "s-scheme", "s-run"] as const;
export type SectionId = (typeof SECTION_IDS)[number];

const INITIAL_BLOCKS: PromptBlocks = {
  role: "",
  granularity: "",
  categories: "",
  rules: "",
  contextFraming: "",
  outputInstruction: "",
};

const INITIAL_DIRTY: PromptBlockDirty = {
  role: false,
  granularity: false,
  categories: false,
  rules: false,
  contextFraming: false,
  outputInstruction: false,
};

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

function resetBlockValue(
  key: PromptBlockKey,
  granularity: Granularity,
  scheme: CodingScheme | null,
  categories: CategoryDefinition[],
): string {
  switch (key) {
    case "role":
      return defaultRole();
    case "granularity":
      return defaultGranularityBlock(granularity);
    case "categories":
      return defaultCategories(categories);
    case "rules":
      return scheme ? defaultRules(scheme) : "";
    case "contextFraming":
      return defaultContextFraming(granularity);
    case "outputInstruction":
      return defaultOutputInstruction(granularity);
    default:
      return "";
  }
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
  audioFiles: File[];
  dragOver: boolean;
  uploadError: string | null;
  setUploadMode: (m: UploadMode) => void;
  setDragOver: (b: boolean) => void;
  processFiles: (fl: FileList) => Promise<void>;
  processAudioInput: (fl: FileList) => void;
  removeFile: (id: string) => void;
  removeAudioFile: (i: number) => void;
  toggleFile: (id: string) => void;

  // Auth / model
  selectedModel: string;
  setSelectedModel: (id: string) => void;
  apiKey: string;
  setApiKey: (k: string) => void;
  showKey: boolean;
  setShowKey: (b: boolean) => void;
  devSignedIn: boolean;
  devPassword: string;
  devAuthError: string;
  setDevPassword: (s: string) => void;
  handleDevSignIn: () => Promise<void>;
  handleDevSignOut: () => void;

  // Scheme + prompt blocks
  schemeId: string | null;
  activeScheme: CodingScheme | null;
  categories: CategoryDefinition[];
  categoriesDirty: boolean;
  granularity: Granularity;
  blocks: PromptBlocks;
  dirty: PromptBlockDirty;
  rawSystemOverride: string | null;
  contextWindow: number;
  setSchemeId: (id: string) => void;
  setGranularity: (g: Granularity) => void;
  setCategories: (c: CategoryDefinition[]) => void;
  resetCategories: () => void;
  updateBlock: (k: PromptBlockKey, v: string) => void;
  resetBlock: (k: PromptBlockKey) => void;
  commitRawOverride: (raw: string) => void;
  revertRawOverride: () => void;
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
  rulesOpen: boolean;
  setRulesOpen: (b: boolean) => void;
  tweaksOpen: boolean;
  setTweaksOpen: (b: boolean) => void;
  activeSectionId: string | null;

  // Autosave
  autosaveState: AutosaveState;
}

export function useCodingSession(): CodingSession {
  const [uploadMode, setUploadMode] = useState<UploadMode>("transcript");
  const [files, setFiles] = useState<TranscriptFile[]>([]);
  const [audioFiles, setAudioFiles] = useState<File[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [apiKey, setApiKeyState] = useState("");
  const [showKey, setShowKey] = useState(false);
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
  const [blocks, setBlocks] = useState<PromptBlocks>(INITIAL_BLOCKS);
  const [dirty, setDirty] = useState<PromptBlockDirty>(INITIAL_DIRTY);
  const [rawSystemOverride, setRawSystemOverride] = useState<string | null>(
    null,
  );
  const [contextWindow, setContextWindow] = useState(DEFAULT_CONTEXT_WINDOW);
  const [openResults, setOpenResults] = useState<Record<string, boolean>>({});
  const [runStartedAt, setRunStartedAt] = useState<number | null>(null);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [tweaksOpen, setTweaksOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const activeSectionId = useScrollSpy(SECTION_IDS as readonly string[] as string[]);

  useEffect(() => {
    const storedKey = localStorage.getItem("anthropic_api_key");
    if (storedKey) setApiKeyState(storedKey);
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
          setBlocks(parsed.blocks);
          setDirty(parsed.dirty);
          setRawSystemOverride(parsed.rawSystemOverride);
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
    setBlocks((prev) => ({
      ...prev,
      categories: defaultCategories(categories),
    }));
  }, [categories]);

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

  const totalTurns = selectedFiles.reduce(
    (s, f) => s + f.progress.total,
    0,
  );
  const completedTurns = selectedFiles.reduce(
    (s, f) => s + f.progress.completed,
    0,
  );

  const persistedSession: PersistedSession | null = useMemo(() => {
    if (!hydrated) return null;
    if (isAnyCoding) return null;
    return {
      version: 1,
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
      blocks,
      dirty,
      rawSystemOverride,
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
    blocks,
    dirty,
    rawSystemOverride,
    contextWindow,
    isAnyCoding,
  ]);

  const autosaveState = useAutosave(persistedSession, hydrated && !isAnyCoding);

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
    setAudioFiles((prev) => [...prev, ...added]);
  }, []);

  const removeFile = useCallback((id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  }, []);

  const removeAudioFile = useCallback((i: number) => {
    setAudioFiles((prev) => prev.filter((_, idx) => idx !== i));
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
      setBlocks(buildDefaultBlocks(scheme, granularity));
      setDirty({ ...INITIAL_DIRTY });
      setRawSystemOverride(null);
    },
    [granularity],
  );

  const setGranularity = useCallback(
    (next: Granularity) => {
      if (rawSystemOverride !== null) {
        const ok =
          typeof window !== "undefined"
            ? window.confirm(
                "Switching granularity will clear your raw prompt override. Continue?",
              )
            : true;
        if (!ok) return;
        setRawSystemOverride(null);
      }
      setGranularityState(next);
      const scheme =
        CODING_SCHEMES.find((sc) => sc.id === schemeId) ?? null;
      setBlocks((prev) => {
        const nextBlocks: PromptBlocks = { ...prev };
        if (!dirty.granularity)
          nextBlocks.granularity = defaultGranularityBlock(next);
        if (!dirty.contextFraming)
          nextBlocks.contextFraming = defaultContextFraming(next);
        if (!dirty.outputInstruction)
          nextBlocks.outputInstruction = defaultOutputInstruction(next);
        if (!dirty.role) nextBlocks.role = defaultRole();
        if (!dirty.rules && scheme) nextBlocks.rules = defaultRules(scheme);
        return nextBlocks;
      });
    },
    [dirty, rawSystemOverride, schemeId],
  );

  const updateBlock = useCallback(
    (key: PromptBlockKey, value: string) => {
      setBlocks((prev) => ({ ...prev, [key]: value }));
      setDirty((prev) => ({ ...prev, [key]: true }));
    },
    [],
  );

  const resetBlock = useCallback(
    (key: PromptBlockKey) => {
      const scheme =
        CODING_SCHEMES.find((sc) => sc.id === schemeId) ?? null;
      setBlocks((prev) => ({
        ...prev,
        [key]: resetBlockValue(key, granularity, scheme, categories),
      }));
      setDirty((prev) => ({ ...prev, [key]: false }));
    },
    [schemeId, granularity, categories],
  );

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

  const commitRawOverride = useCallback((raw: string) => {
    setRawSystemOverride(raw);
  }, []);

  const revertRawOverride = useCallback(() => {
    setRawSystemOverride(null);
  }, []);

  const toggleResultsOpen = useCallback((fileId: string) => {
    setOpenResults((prev) => ({ ...prev, [fileId]: !prev[fileId] }));
  }, []);

  const runCoding = useCallback(async () => {
    if (!hasFiles) return;
    setApiLogs([]);
    setRunStartedAt(Date.now());
    const filesToCode = files.filter((f) => f.selected);

    const effectiveBlocks: PromptBlocks =
      rawSystemOverride !== null
        ? {
            role: rawSystemOverride,
            granularity: "",
            categories: "",
            rules: "",
            contextFraming: "",
            outputInstruction: "",
          }
        : blocks;

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
            blocks: effectiveBlocks,
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
    blocks,
    contextWindow,
    devSignedIn,
    apiKey,
    rawSystemOverride,
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

    selectedModel,
    setSelectedModel,
    apiKey,
    setApiKey,
    showKey,
    setShowKey,
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
    blocks,
    dirty,
    rawSystemOverride,
    contextWindow,
    setSchemeId,
    setGranularity,
    setCategories,
    resetCategories,
    updateBlock,
    resetBlock,
    commitRawOverride,
    revertRawOverride,
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

    rulesOpen,
    setRulesOpen,
    tweaksOpen,
    setTweaksOpen,
    activeSectionId,

    autosaveState,
  };
}
