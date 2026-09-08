"use client";
/**
 * WHAT:    The one object every /coding component reads through useSession().
 *          This file holds no logic of its own: it calls one hook per step
 *          (Upload, Model, Scheme, Run) plus persistence and scroll-spy, and
 *          assembles their results into the CodingSession shape below.
 * STEP:    Shared. Provided by CodingSessionContext.tsx; consumed by every
 *          section component. To change behaviour, edit the step hook, not this.
 * RUNS ON: client only
 */
import {
  ApiLog,
  CategoryDefinition,
  CodedUnit,
  CodingScheme,
  OutputType,
  RatingScale,
  SegmentationStrategy,
  TranscriptFile,
} from "@/lib/types";
import type { ProviderId, ReasoningLevel } from "@/lib/models";
import { useTranscriptFiles } from "./useTranscriptFiles";
import { useModelAndKeys } from "./useModelAndKeys";
import { useSchemeSettings } from "./useSchemeSettings";
import { useCodingRun } from "./useCodingRun";
import { useSessionPersistence } from "./useSessionPersistence";
import { AutosaveState } from "./useAutosave";
import { RunStats } from "./useRunStats";
import { useScrollSpy } from "./useScrollSpy";

export const SECTION_IDS = [
  "s-upload",
  "s-model",
  "s-scheme",
  "s-run",
] as const;
export type SectionId = (typeof SECTION_IDS)[number];

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
  const upload = useTranscriptFiles();
  const model = useModelAndKeys();
  const scheme = useSchemeSettings();
  const run = useCodingRun({ upload, model, scheme });
  const autosaveState = useSessionPersistence({
    upload,
    model,
    scheme,
    isAnyCoding: run.isAnyCoding,
  });
  const activeSectionId = useScrollSpy(
    SECTION_IDS as readonly string[] as string[],
  );

  // Which of the four steps is complete, for the stage rail's checkmarks.
  const stepDone: [boolean, boolean, boolean, boolean] = [
    upload.hasFiles,
    model.selectedModel !== "" && model.activeProviderKey !== "",
    scheme.schemeId !== null,
    upload.anySelected &&
      upload.selectedFiles.length > 0 &&
      upload.selectedFiles.every((f) => f.status === "done"),
  ];

  return {
    files: upload.files,
    dragOver: upload.dragOver,
    uploadError: upload.uploadError,
    setDragOver: upload.setDragOver,
    processFiles: upload.processFiles,
    removeFile: upload.removeFile,
    toggleFile: upload.toggleFile,
    setFileTopic: upload.setFileTopic,
    transcribeAudio: upload.transcribeAudio,
    transcribeAllPending: upload.transcribeAllPending,
    downloadRawTranscript: upload.downloadRawTranscript,
    isAnyTranscribing: upload.isAnyTranscribing,
    pendingAudioCount: upload.pendingAudioCount,

    selectedModel: model.selectedModel,
    setSelectedModel: model.setSelectedModel,
    reasoningLevel: model.reasoningLevel,
    setReasoningLevel: model.setReasoningLevel,
    apiKey: model.apiKey,
    setApiKey: model.setApiKey,
    openaiKey: model.openaiKey,
    setOpenaiKey: model.setOpenaiKey,
    googleKey: model.googleKey,
    setGoogleKey: model.setGoogleKey,
    showKey: model.showKey,
    setShowKey: model.setShowKey,
    activeProvider: model.activeProvider,
    activeProviderKey: model.activeProviderKey,
    setActiveProviderKey: model.setActiveProviderKey,
    elevenLabsKey: upload.elevenLabsKey,
    setElevenLabsKey: upload.setElevenLabsKey,
    showElevenKey: upload.showElevenKey,
    setShowElevenKey: upload.setShowElevenKey,

    schemeId: scheme.schemeId,
    activeScheme: scheme.activeScheme,
    categories: scheme.categories,
    categoriesDirty: scheme.categoriesDirty,
    segmentation: scheme.segmentation,
    outputType: scheme.outputType,
    scale: scheme.scale,
    windowSeconds: scheme.windowSeconds,
    perSpeaker: scheme.perSpeaker,
    batchSize: scheme.batchSize,
    systemPrompt: scheme.systemPrompt,
    promptDirty: scheme.promptDirty,
    contextBefore: scheme.contextBefore,
    contextAfter: scheme.contextAfter,
    setSchemeId: scheme.setSchemeId,
    setSegmentation: scheme.setSegmentation,
    setOutputType: scheme.setOutputType,
    setScale: scheme.setScale,
    setWindowSeconds: scheme.setWindowSeconds,
    setPerSpeaker: scheme.setPerSpeaker,
    setBatchSize: scheme.setBatchSize,
    setCategories: scheme.setCategories,
    resetCategories: scheme.resetCategories,
    setSystemPrompt: scheme.setSystemPrompt,
    resetPrompt: scheme.resetPrompt,
    setContextBefore: scheme.setContextBefore,
    setContextAfter: scheme.setContextAfter,

    apiLogs: run.apiLogs,
    isAnyCoding: run.isAnyCoding,
    anySelected: upload.anySelected,
    runCoding: run.runCoding,
    handleExportAll: run.handleExportAll,
    openResults: run.openResults,
    toggleResultsOpen: run.toggleResultsOpen,

    hasFiles: upload.hasFiles,
    stepDone,
    selectedFiles: upload.selectedFiles,
    totalTurns: run.totalTurns,
    completedTurns: run.completedTurns,
    allCodedUnits: run.allCodedUnits,
    categoryColorMap: scheme.categoryColorMap,
    runStartedAt: run.runStartedAt,
    runStats: run.runStats,
    modelName: model.modelName,
    schemeName: scheme.schemeName,
    doneFiles: run.doneFiles,

    activeSectionId,

    autosaveState,
  };
}
