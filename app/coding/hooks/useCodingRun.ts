"use client";
/**
 * WHAT:    Step 4 (Run) state: starts a coding run (one POST per selected file),
 *          consumes the streamed results into the file list, keeps the API logs,
 *          freezes the configuration the run started with, derives progress/cost
 *          stats, can stop a run, and exports coded files to CSV (the combined
 *          export, and the audit export for CSV-origin conversations).
 * STEP:    Run. Rendered by components/sections/SectionRun.tsx and components/run/*;
 *          composed into the session by useCodingSession.ts.
 * RUNS ON: client only
 * STORAGE: sessionStorage "api_logs" (mirror of the logs for the /logs page)
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ApiLog,
  CodedUnit,
  CodingMode,
  RunConfigSnapshot,
  TranscriptFile,
} from "@/lib/types";
import { segmentFile } from "@/lib/transcript/segment";
import { isCodeable, isCsvOrigin } from "@/lib/transcript/file-origin";
import { alignIncomingUnit } from "@/lib/results/align-utterances";
import { sortUnits } from "@/lib/results/sort-units";
import { generateCsv, dimsFromUnits } from "@/lib/results/generate-csv";
import {
  generateAuditCsv,
  auditCsvFileName,
} from "@/lib/results/generate-audit-csv";
import { escapeCsvField } from "@/lib/results/csv-escape";
import { readSseEvents } from "@/lib/coding/sse";
import { useRunStats, RunStats } from "./useRunStats";
import type { TranscriptFilesState } from "./useTranscriptFiles";
import type { ModelAndKeysState } from "./useModelAndKeys";
import type { SchemeSettingsState } from "./useSchemeSettings";

/** Minimum gap between sessionStorage writes of the log mirror during a run. */
const LOG_MIRROR_INTERVAL_MS = 2000;

export interface CodingRunState {
  apiLogs: ApiLog[];
  isAnyCoding: boolean;
  runCoding: () => Promise<void>;
  /** Abort the run in progress: the current file's stream closes, later files never start. */
  stopRun: () => void;
  canStop: boolean;
  handleExportAll: () => void;
  /** The audit CSV for CSV-origin conversations of the last run. */
  exportAuditCsv: (includeBulky: boolean) => void;
  hasAuditExport: boolean;
  openResults: Record<string, boolean>;
  toggleResultsOpen: (fileId: string) => void;

  // Derived
  runStartedAt: number | null;
  /** What the last run was started with; null before the first run. */
  runConfig: RunConfigSnapshot | null;
  runStats: RunStats;
  totalUnits: number;
  completedUnits: number;
  allCodedUnits: CodedUnit[];
  doneFiles: TranscriptFile[];
}

function downloadText(text: string, fileName: string): void {
  const blob = new Blob([text], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

export function useCodingRun({
  upload,
  model,
  scheme,
}: {
  upload: TranscriptFilesState;
  model: ModelAndKeysState;
  scheme: SchemeSettingsState;
}): CodingRunState {
  // Destructure to primitives so the callbacks below depend on exactly the
  // values they read, not on the (unstable) hook result objects.
  const { files, setFiles, hasFiles, selectedFiles } = upload;
  const {
    selectedModel,
    modelName,
    activeProvider,
    reasoningLevel,
    activeProviderKey,
  } = model;
  const {
    schemeId,
    schemeName,
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
  } = scheme;

  const [apiLogs, setApiLogs] = useState<ApiLog[]>([]);
  const [openResults, setOpenResults] = useState<Record<string, boolean>>({});
  const [runStartedAt, setRunStartedAt] = useState<number | null>(null);
  const [runConfig, setRunConfig] = useState<RunConfigSnapshot | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  // Guards against a second click starting an interleaved run, and lets Stop
  // abort the fetch in flight.
  const runningRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  const lastMirrorRef = useRef(0);

  const isAnyCoding = files.some((f) => f.status === "coding");

  // Mirror the logs for /logs, throttled during a run (a long run appends
  // thousands of large logs; serializing the whole array on each one is
  // quadratic work) and written once more when the run ends.
  useEffect(() => {
    const write = () => {
      lastMirrorRef.current = Date.now();
      try {
        if (apiLogs.length > 0) {
          sessionStorage.setItem("api_logs", JSON.stringify(apiLogs));
        } else {
          sessionStorage.removeItem("api_logs");
        }
      } catch {
        // Quota exceeded on a very long run: /logs will show a partial list.
      }
    };
    const since = Date.now() - lastMirrorRef.current;
    if (!isAnyCoding || since >= LOG_MIRROR_INTERVAL_MS) {
      write();
      return;
    }
    const handle = window.setTimeout(write, LOG_MIRROR_INTERVAL_MS - since);
    return () => window.clearTimeout(handle);
  }, [apiLogs, isAnyCoding]);

  const allCodedUnits = useMemo(
    () => selectedFiles.flatMap((f) => f.codedUnits),
    [selectedFiles],
  );

  const totalUnits = selectedFiles.reduce((s, f) => s + f.progress.total, 0);
  const completedUnits = selectedFiles.reduce(
    (s, f) => s + f.progress.completed,
    0,
  );

  const runStats = useRunStats(
    apiLogs,
    runStartedAt,
    totalUnits,
    completedUnits,
    isAnyCoding,
  );

  const toggleResultsOpen = useCallback((fileId: string) => {
    setOpenResults((prev) => ({ ...prev, [fileId]: !prev[fileId] }));
  }, []);

  const stopRun = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const runCoding = useCallback(async () => {
    if (!hasFiles || runningRef.current) return;
    runningRef.current = true;
    const controller = new AbortController();
    abortRef.current = controller;
    const { signal } = controller;
    setIsRunning(true);
    setApiLogs([]);
    setRunStartedAt(Date.now());

    // Freeze what this run is about to use, so an export made after the run
    // describes it even if a setting is changed in the meantime.
    const snapshot: RunConfigSnapshot = {
      runId: Date.now().toString(36),
      startedAt: new Date().toISOString(),
      modelId: selectedModel,
      modelName,
      provider: activeProvider,
      reasoningEffort: reasoningLevel,
      schemeId,
      schemeName,
      categories: categories.map((c) => ({ ...c })),
      categoriesDirty,
      segmentation,
      outputType,
      scale: { ...scale },
      windowSeconds,
      perSpeaker,
      batchSize,
      contextBefore,
      contextAfter,
      systemPrompt,
      promptDirty,
    };
    setRunConfig(snapshot);

    const filesToCode = files.filter((f) => f.selected && isCodeable(f));

    try {
      for (const file of filesToCode) {
        if (signal.aborted) break;
        const mode: CodingMode = {
          segmentation,
          outputType,
          scale,
          windowSeconds,
          perSpeaker,
          batchSize,
        };

        try {
          // Inside the try so a file the mode cannot cut marks this file as
          // errored instead of aborting the whole multi-file loop. The
          // request body below is an explicit field list: a CSV-origin file's
          // human codes live in `file.source` and are never part of it.
          const cut = segmentFile(file, mode);
          if (!cut.ok) throw new Error(cut.error);
          const { turns, segments: segs } = cut;

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

          const response = await fetch("/api/code", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            signal,
            body: JSON.stringify({
              segments: segs,
              mode,
              model: selectedModel,
              reasoningEffort: reasoningLevel,
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

          if (!response.body) throw new Error("No response stream");

          for await (const { event, data } of readSseEvents(response.body)) {
            if (event === "result") {
              const parsed = JSON.parse(data) as {
                codedUnit?: CodedUnit;
              };
              const incoming = parsed.codedUnit;
              if (incoming) {
                const aligned = alignIncomingUnit(
                  incoming,
                  file.rawTranscript,
                  turns,
                  segmentation,
                );
                setFiles((prev) =>
                  prev.map((f) =>
                    f.id === file.id
                      ? { ...f, codedUnits: [...f.codedUnits, aligned] }
                      : f,
                  ),
                );
              }
            } else if (event === "progress") {
              const progress = JSON.parse(data);
              setFiles((prev) =>
                prev.map((f) =>
                  f.id === file.id ? { ...f, progress } : f,
                ),
              );
            } else if (event === "log") {
              const log = JSON.parse(data) as ApiLog;
              log.fileName = file.fileName;
              log.fileId = file.id;
              setApiLogs((prev) => [...prev, log]);
            } else if (event === "error") {
              const { message } = JSON.parse(data);
              setFiles((prev) =>
                prev.map((f) =>
                  f.id === file.id
                    ? { ...f, status: "error" as const, error: message }
                    : f,
                ),
              );
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
          const stopped =
            signal.aborted ||
            (err instanceof Error && err.name === "AbortError");
          setFiles((prev) =>
            prev.map((f) =>
              f.id === file.id
                ? {
                    ...f,
                    status: "error" as const,
                    error: stopped
                      ? "Stopped"
                      : err instanceof Error
                      ? err.message
                      : "Unknown error",
                  }
                : f,
            ),
          );
        }
      }
    } finally {
      runningRef.current = false;
      abortRef.current = null;
      setIsRunning(false);
    }
  }, [
    files,
    setFiles,
    hasFiles,
    selectedModel,
    modelName,
    activeProvider,
    reasoningLevel,
    schemeId,
    schemeName,
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
    activeProviderKey,
  ]);

  const doneFiles = useMemo(
    () =>
      files.filter(
        (f) => f.selected && f.status === "done" && f.codedUnits.length > 0,
      ),
    [files],
  );

  // CSV-origin conversations with any results, including one cut short by Stop:
  // rows without a result get blank result cells in the audit export.
  const auditFiles = useMemo(
    () =>
      files.filter(
        (f) => f.selected && isCsvOrigin(f) && f.codedUnits.length > 0,
      ),
    [files],
  );
  const hasAuditExport =
    !isRunning && runConfig !== null && auditFiles.length > 0;

  const handleExportAll = useCallback(() => {
    const dims = dimsFromUnits(doneFiles.flatMap((f) => f.codedUnits));

    let header: string | null = null;
    const rows: string[] = [];
    for (const f of doneFiles) {
      const sorted = sortUnits(f.codedUnits);
      const csv = generateCsv(sorted, undefined, dims);
      const lines = csv.split("\n");
      if (header === null) header = `File,Topic,${lines[0]}`;
      const escapedName = escapeCsvField(f.fileName);
      const escapedTopic = escapeCsvField(f.topic ?? "");
      for (const line of lines.slice(1)) {
        rows.push(`${escapedName},${escapedTopic},${line}`);
      }
    }

    downloadText([header ?? "", ...rows].join("\n"), "coded_units_all.csv");
  }, [doneFiles]);

  const exportAuditCsv = useCallback(
    (includeBulky: boolean) => {
      if (!runConfig || auditFiles.length === 0) return;
      // The in-memory logs, never the sessionStorage mirror (which can be
      // partial after a long run).
      const csv = generateAuditCsv({
        files: auditFiles,
        apiLogs,
        config: runConfig,
        includeBulky,
      });
      downloadText(csv, auditCsvFileName(auditFiles, runConfig.runId));
    },
    [auditFiles, apiLogs, runConfig],
  );

  return {
    apiLogs,
    isAnyCoding,
    runCoding,
    stopRun,
    canStop: isRunning,
    handleExportAll,
    exportAuditCsv,
    hasAuditExport,
    openResults,
    toggleResultsOpen,

    runStartedAt,
    runConfig,
    runStats,
    totalUnits,
    completedUnits,
    allCodedUnits,
    doneFiles,
  };
}
