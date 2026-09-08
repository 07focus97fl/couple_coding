"use client";
/**
 * WHAT:    Step 1 (Upload) state: the list of transcript files, drag-and-drop,
 *          reading JSON transcripts, sending audio to /api/transcribe, and the
 *          ElevenLabs key that transcription needs.
 * STEP:    Upload. Rendered by components/sections/SectionUpload.tsx; composed
 *          into the session by useCodingSession.ts.
 * RUNS ON: client only
 * STORAGE: localStorage "elevenlabs_api_key"
 */
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import { RawTranscript, TranscriptFile } from "@/lib/types";
import { parseTranscript } from "@/lib/transcript/parse-transcript";
import type { PersistedFile } from "./autosave-schema";

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

export interface TranscriptFilesState {
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
  elevenLabsKey: string;
  setElevenLabsKey: (k: string) => void;
  showElevenKey: boolean;
  setShowElevenKey: (b: boolean) => void;

  // Derived
  hasFiles: boolean;
  anySelected: boolean;
  selectedFiles: TranscriptFile[];

  // For sibling hooks (not part of the public session)
  /** Raw state setter; the run hook uses it to stream results into files. */
  setFiles: Dispatch<SetStateAction<TranscriptFile[]>>;
  /** Read the ElevenLabs key from localStorage (hydration). */
  loadStoredKeys: () => void;
  /** Replace the file list from an autosave snapshot (hydration). */
  restoreFiles: (persisted: PersistedFile[]) => void;
}

export function useTranscriptFiles(): TranscriptFilesState {
  const [files, setFiles] = useState<TranscriptFile[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [elevenLabsKey, setElevenLabsKeyState] = useState("");
  const [showElevenKey, setShowElevenKey] = useState(false);
  const audioAbortersRef = useRef<Map<string, AbortController>>(new Map());
  const filesRef = useRef<TranscriptFile[]>([]);

  useEffect(() => {
    filesRef.current = files;
  }, [files]);

  // Called once on mount by useSessionPersistence.
  const loadStoredKeys = useCallback(() => {
    const storedEleven = localStorage.getItem("elevenlabs_api_key");
    if (storedEleven) setElevenLabsKeyState(storedEleven);
  }, []);

  const hasFiles = files.length > 0;
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

  // ── Handlers ──

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

  // Autosave stores the raw transcript and a few flags; turns are re-parsed
  // here, coded units and progress are rebuilt at run time.
  const restoreFiles = useCallback((persisted: PersistedFile[]) => {
    setFiles(
      persisted
        .filter((f) => f.rawTranscript !== null)
        .map((f) => {
          const rawTranscript = f.rawTranscript as RawTranscript;
          const turns = Array.isArray(rawTranscript.words)
            ? parseTranscript(rawTranscript.words)
            : [];
          return {
            id: f.id,
            fileName: f.fileName,
            rawTranscript,
            turns,
            codedUnits: [],
            selected: f.selected,
            status: "pending" as const,
            progress: { completed: 0, total: turns.length },
            topic: f.topic ?? "",
          };
        }),
    );
  }, []);

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
    elevenLabsKey,
    setElevenLabsKey,
    showElevenKey,
    setShowElevenKey,

    hasFiles,
    anySelected,
    selectedFiles,

    setFiles,
    loadStoredKeys,
    restoreFiles,
  };
}
