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
    if (a.turnNumber !== b.turnNumber) return a.turnNumber - b.turnNumber;
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
  activeSectionId: string | null;

  // Autosave
  autosaveState: AutosaveState;
}

export function useCodingSession(): CodingSession {
  const [files, setFiles] = useState<TranscriptFile[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [apiKey, setApiKeyState] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [elevenLabsKey, setElevenLabsKeyState] = useState("");
  const [showElevenKey, setShowElevenKey] = useState(false);
  const audioAbortersRef = useRef<Map<string, AbortController>>(new Map());
  const filesRef = useRef<TranscriptFile[]>([]);
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
      version: 3,
      files: files.map((f) => ({
        id: f.id,
        fileName: f.fileName,
        rawTranscript: f.rawTranscript,
        selected: f.selected,
        topic: f.topic ?? "",
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
        if (!devSignedIn && elevenLabsKey) {
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
    [elevenLabsKey, devSignedIn],
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
      if (!file.rawTranscript) continue;
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
            topic: file.topic ?? "",
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
    const topicHeader = "Topic";
    const colHeaders = COLUMN_DEFINITIONS.map((c) => c.csvHeader);
    const header = [fileHeader, topicHeader, ...colHeaders].join(",");

    const escapeField = (v: string) =>
      v.includes(",") || v.includes('"') || v.includes("\n")
        ? `"${v.replace(/"/g, '""')}"`
        : v;

    const rows: string[] = [];
    for (const f of doneFiles) {
      const sorted = sortUnits(f.codedUnits);
      const csv = generateCsv(sorted);
      const csvLines = csv.split("\n").slice(1);
      const escapedName = escapeField(f.fileName);
      const escapedTopic = escapeField(f.topic ?? "");
      for (const line of csvLines) {
        rows.push(`${escapedName},${escapedTopic},${line}`);
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

    activeSectionId,

    autosaveState,
  };
}
