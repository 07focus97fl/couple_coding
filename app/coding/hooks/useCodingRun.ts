"use client";
/**
 * WHAT:    Step 4 (Run) state: starts a coding run (one POST per selected file),
 *          consumes the streamed results into the file list, keeps the API logs,
 *          derives progress/cost stats, and exports every coded file to one CSV.
 * STEP:    Run. Rendered by components/sections/SectionRun.tsx and components/run/*;
 *          composed into the session by useCodingSession.ts.
 * RUNS ON: client only
 * STORAGE: sessionStorage "api_logs" (mirror of the logs for the /logs page)
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { ApiLog, CodedUnit, CodingMode, TranscriptFile } from "@/lib/types";
import { parseTranscript } from "@/lib/transcript/parse-transcript";
import { segment } from "@/lib/transcript/segment";
import { alignIncomingUnit } from "@/lib/results/align-utterances";
import { sortUnits } from "@/lib/results/sort-units";
import { generateCsv, dimsFromUnits } from "@/lib/results/generate-csv";
import { readSseEvents } from "@/lib/coding/sse";
import { useRunStats, RunStats } from "./useRunStats";
import type { TranscriptFilesState } from "./useTranscriptFiles";
import type { ModelAndKeysState } from "./useModelAndKeys";
import type { SchemeSettingsState } from "./useSchemeSettings";

export interface CodingRunState {
  apiLogs: ApiLog[];
  isAnyCoding: boolean;
  runCoding: () => Promise<void>;
  handleExportAll: () => void;
  openResults: Record<string, boolean>;
  toggleResultsOpen: (fileId: string) => void;

  // Derived
  runStartedAt: number | null;
  runStats: RunStats;
  totalUnits: number;
  completedUnits: number;
  allCodedUnits: CodedUnit[];
  doneFiles: TranscriptFile[];
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
  const { selectedModel, reasoningLevel, activeProviderKey } = model;
  const {
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
  } = scheme;

  const [apiLogs, setApiLogs] = useState<ApiLog[]>([]);
  const [openResults, setOpenResults] = useState<Record<string, boolean>>({});
  const [runStartedAt, setRunStartedAt] = useState<number | null>(null);

  useEffect(() => {
    if (apiLogs.length > 0) {
      sessionStorage.setItem("api_logs", JSON.stringify(apiLogs));
    }
  }, [apiLogs]);

  const isAnyCoding = files.some((f) => f.status === "coding");

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
    setFiles,
    hasFiles,
    selectedModel,
    reasoningLevel,
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
    apiLogs,
    isAnyCoding,
    runCoding,
    handleExportAll,
    openResults,
    toggleResultsOpen,

    runStartedAt,
    runStats,
    totalUnits,
    completedUnits,
    allCodedUnits,
    doneFiles,
  };
}
