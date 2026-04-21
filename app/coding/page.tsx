"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import Link from "next/link";
import { CategoryEditor } from "./components/CategoryEditor";
import { ExportButton } from "./components/ExportButton";
import {
  TooltipProvider,
  TooltipRoot,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { parseTranscript } from "@/lib/parse-transcript";
import { generateCsv } from "@/lib/generate-csv";
import { CODING_SCHEMES } from "@/lib/coding-schemes";
import {
  RawTranscript,
  COLUMN_DEFINITIONS,
  TranscriptFile,
  CategoryDefinition,
  ApiLog,
  DEFAULT_CONTEXT_WINDOW,
} from "@/lib/types";
import s from "./coding.module.css";

const STEP_LABELS = ["Upload", "Model", "Configure", "Run"] as const;

type ModelDef = { id: string; name: string; desc: string; badge: string | null };
type ProviderDef = {
  id: "anthropic" | "openai" | "google" | "oss";
  name: string;
  accent: string;
  comingSoon?: boolean;
  models: ModelDef[];
};

const MODEL_PROVIDERS: ProviderDef[] = [
  {
    id: "anthropic",
    name: "Anthropic",
    accent: "#c45d3e",
    models: [
      { id: "claude-opus-4-7", name: "Claude Opus 4.7", desc: "Flagship — 1M context, highest accuracy on nuanced turns", badge: "Flagship" },
      { id: "claude-sonnet-4-6", name: "Claude Sonnet 4.6", desc: "Fast & capable — ideal for most coding tasks", badge: "Recommended" },
      { id: "claude-haiku-4-5-20251001", name: "Claude Haiku 4.5", desc: "Fastest — good for simple binary schemes", badge: null },
    ],
  },
  {
    id: "openai",
    name: "OpenAI",
    accent: "#10a37f",
    comingSoon: true,
    models: [
      { id: "gpt-5-pro", name: "GPT-5 Pro", desc: "Deepest reasoning — OpenAI's flagship", badge: "Flagship" },
      { id: "gpt-5", name: "GPT-5", desc: "Balanced general-purpose model", badge: null },
      { id: "o4", name: "o4", desc: "Reasoning specialist for ambiguous turns", badge: null },
    ],
  },
  {
    id: "google",
    name: "Google",
    accent: "#4285f4",
    comingSoon: true,
    models: [
      { id: "gemini-3-pro", name: "Gemini 3 Pro", desc: "Long-context, multimodal flagship", badge: "Flagship" },
      { id: "gemini-3-flash", name: "Gemini 3 Flash", desc: "High-throughput, low-latency coding", badge: null },
    ],
  },
  {
    id: "oss",
    name: "Open Source",
    accent: "#8a63d2",
    comingSoon: true,
    models: [
      { id: "llama-4-405b", name: "Llama 4 405B", desc: "Meta's largest open-weight model", badge: "Flagship" },
      { id: "deepseek-r1", name: "DeepSeek R1", desc: "Open reasoning model — strong at nuance", badge: null },
      { id: "qwen-3-72b", name: "Qwen 3 72B", desc: "Alibaba's open multilingual flagship", badge: null },
    ],
  },
];

const MODELS = MODEL_PROVIDERS.flatMap((p) => p.models);

function ProviderIcon({ provider }: { provider: ProviderDef["id"] }) {
  const common = {
    width: 14,
    height: 14,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.9,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  if (provider === "anthropic") {
    return (
      <svg {...common}>
        <line x1="12" y1="3" x2="12" y2="21" />
        <line x1="3" y1="12" x2="21" y2="12" />
        <line x1="5.6" y1="5.6" x2="18.4" y2="18.4" />
        <line x1="18.4" y1="5.6" x2="5.6" y2="18.4" />
      </svg>
    );
  }
  if (provider === "openai") {
    return (
      <svg {...common}>
        <circle cx="12" cy="8.8" r="3.8" />
        <circle cx="8.6" cy="14.6" r="3.8" />
        <circle cx="15.4" cy="14.6" r="3.8" />
      </svg>
    );
  }
  if (provider === "google") {
    return (
      <svg {...common}>
        <path d="M20 12a8 8 0 11-2.3-5.6" />
        <path d="M20 12h-6" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <polyline points="8 6 3 12 8 18" />
      <polyline points="16 6 21 12 16 18" />
      <line x1="14" y1="5" x2="10" y2="19" />
    </svg>
  );
}

function readJsonFile(file: File): Promise<{ fileName: string; transcript: RawTranscript }> {
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

export default function CodingPage() {
  const [step, setStep] = useState(0);
  const [uploadMode, setUploadMode] = useState<"audio" | "transcript">("audio");
  const [files, setFiles] = useState<TranscriptFile[]>([]);
  const [audioFiles, setAudioFiles] = useState<File[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [devSignedIn, setDevSignedIn] = useState(false);
  const [devPassword, setDevPassword] = useState("");
  const [devAuthError, setDevAuthError] = useState("");
  const [apiLogs, setApiLogs] = useState<ApiLog[]>([]);
  const [selectedModel, setSelectedModel] = useState("");
  const [schemeId, setSchemeId] = useState<string | null>(null);
  const [categories, setCategories] = useState<CategoryDefinition[]>([]);
  const [customRules, setCustomRules] = useState("");
  const [contextWindow, setContextWindow] = useState(DEFAULT_CONTEXT_WINDOW);
  const [openResults, setOpenResults] = useState<Record<string, boolean>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const stored = localStorage.getItem("anthropic_api_key");
    if (stored) setApiKey(stored);
    if (localStorage.getItem("dev_signed_in") === "true") setDevSignedIn(true);
  }, []);

  useEffect(() => {
    if (apiLogs.length > 0) {
      sessionStorage.setItem("api_logs", JSON.stringify(apiLogs));
    }
  }, [apiLogs]);

  const handleApiKeyChange = (val: string) => {
    setApiKey(val);
    if (val) localStorage.setItem("anthropic_api_key", val);
    else localStorage.removeItem("anthropic_api_key");
  };

  const handleDevSignIn = async () => {
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
        setDevPassword("");
      } else {
        setDevAuthError("Wrong password");
      }
    } catch {
      setDevAuthError("Auth request failed");
    }
  };

  const handleDevSignOut = () => {
    localStorage.removeItem("dev_signed_in");
    setDevSignedIn(false);
    setDevPassword("");
    setDevAuthError("");
  };

  const hasFiles = files.length > 0;
  const isAnyCoding = files.some((f) => f.status === "coding");
  const anySelected = files.some((f) => f.selected);

  const canAdvance = () => {
    if (step === 0) return uploadMode === "audio" ? audioFiles.length > 0 : hasFiles;
    if (step === 1) return selectedModel !== "" && (apiKey !== "" || devSignedIn);
    if (step === 2) return schemeId !== null;
    return true;
  };

  const stepDone = [
    hasFiles,
    selectedModel !== "" && apiKey !== "",
    schemeId !== null,
    anySelected && files.filter((f) => f.selected).every((f) => f.status === "done"),
  ];

  // ── File handling ──
  const processFiles = useCallback(async (fileList: FileList) => {
    setUploadError(null);
    try {
      const results = await Promise.all(Array.from(fileList).map(readJsonFile));
      const newFiles: TranscriptFile[] = results.map((f) => ({
        id: crypto.randomUUID(),
        fileName: f.fileName,
        rawTranscript: f.transcript,
        turns: [],
        codedTurns: [],
        selected: true,
        status: "pending" as const,
        progress: { completed: 0, total: 0 },
      }));
      setFiles((prev) => [...prev, ...newFiles]);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Failed to read files.");
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length > 0) processFiles(e.dataTransfer.files);
  }, [processFiles]);

  const handleAudioDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    setUploadError(null);
    const added = Array.from(e.dataTransfer.files).filter((f) =>
      /\.(mp3|mp4|wav)$/i.test(f.name)
    );
    if (added.length === 0) {
      setUploadError("Only MP3, MP4, or WAV files are accepted.");
      return;
    }
    setAudioFiles((prev) => [...prev, ...added]);
  }, []);

  const processAudioInput = useCallback((fileList: FileList) => {
    setUploadError(null);
    const added = Array.from(fileList).filter((f) =>
      /\.(mp3|mp4|wav)$/i.test(f.name)
    );
    if (added.length === 0) {
      setUploadError("Only MP3, MP4, or WAV files are accepted.");
      return;
    }
    setAudioFiles((prev) => [...prev, ...added]);
  }, []);

  const removeAudioFile = (index: number) => setAudioFiles((prev) => prev.filter((_, i) => i !== index));

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const removeFile = (id: string) => setFiles((prev) => prev.filter((f) => f.id !== id));
  const toggleFile = (id: string) => setFiles((prev) => prev.map((f) => f.id === id ? { ...f, selected: !f.selected } : f));

  // ── Scheme handling ──
  const handleSchemeChange = useCallback((id: string) => {
    setSchemeId(id);
    const scheme = CODING_SCHEMES.find((sc) => sc.id === id);
    if (scheme) {
      setCategories(scheme.categories);
      setCustomRules(scheme.rules ?? "");
    }
  }, []);

  // ── Coding ──
  const handleCode = async () => {
    if (!hasFiles) return;
    setApiLogs([]);
    const filesToCode = files.filter((f) => f.selected);

    for (const file of filesToCode) {
      const turns = file.turns.length > 0 ? file.turns : parseTranscript(file.rawTranscript.words);

      setFiles((prev) =>
        prev.map((f) =>
          f.id === file.id
            ? { ...f, turns, status: "coding" as const, codedTurns: [], error: undefined, progress: { completed: 0, total: turns.length } }
            : f
        )
      );

      try {
        const response = await fetch("/api/code", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            turns,
            model: selectedModel,
            categories,
            rules: customRules || undefined,
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
                const { codedTurn } = JSON.parse(data);
                setFiles((prev) =>
                  prev.map((f) => f.id === file.id ? { ...f, codedTurns: [...f.codedTurns, codedTurn] } : f)
                );
              } else if (eventType === "progress") {
                const progress = JSON.parse(data);
                setFiles((prev) =>
                  prev.map((f) => f.id === file.id ? { ...f, progress } : f)
                );
              } else if (eventType === "log") {
                const log = JSON.parse(data) as ApiLog;
                setApiLogs((prev) => [...prev, log]);
              } else if (eventType === "error") {
                const { message } = JSON.parse(data);
                setFiles((prev) =>
                  prev.map((f) => f.id === file.id ? { ...f, status: "error" as const, error: message } : f)
                );
              }
              eventType = "";
            }
          }
        }

        setFiles((prev) =>
          prev.map((f) => f.id === file.id && f.status !== "error" ? { ...f, status: "done" as const } : f)
        );
      } catch (err) {
        setFiles((prev) =>
          prev.map((f) =>
            f.id === file.id
              ? { ...f, status: "error" as const, error: err instanceof Error ? err.message : "Unknown error" }
              : f
          )
        );
      }
    }
  };

  const doneFiles = files.filter((f) => f.selected && f.status === "done" && f.codedTurns.length > 0);
  const showExportAll = doneFiles.length > 1;

  const handleExportAll = () => {
    const fileHeader = "File";
    const colHeaders = COLUMN_DEFINITIONS.map((c) => c.csvHeader);
    const header = [fileHeader, ...colHeaders].join(",");

    const rows: string[] = [];
    for (const f of doneFiles) {
      const sorted = [...f.codedTurns].sort((a, b) => a.turnNumber - b.turnNumber);
      const csv = generateCsv(sorted);
      const csvLines = csv.split("\n").slice(1); // skip header
      for (const line of csvLines) {
        const escapedName = f.fileName.includes(",") || f.fileName.includes('"')
          ? `"${f.fileName.replace(/"/g, '""')}"`
          : f.fileName;
        rows.push(`${escapedName},${line}`);
      }
    }

    const blob = new Blob([[header, ...rows].join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "coded_turns_all.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const activeScheme = CODING_SCHEMES.find((sc) => sc.id === schemeId);
  const modelName = MODELS.find((m) => m.id === selectedModel)?.name || "";
  const schemeName = activeScheme?.label || (schemeId === "custom" ? "Custom" : "");

  const toggleResultsOpen = (fileId: string) => {
    setOpenResults((prev) => ({ ...prev, [fileId]: !prev[fileId] }));
  };

  return (
    <div className={s.page}>
      {/* ── SIDEBAR ── */}
      <aside className={s.sidebar}>
        <div>
          <Link href="/" className={s.logo}>
            CCC<span className={s.logoAccent}>.</span>
          </Link>
          <div className={s.logoSub}>Couple Conversation Coder</div>

          <div className={s.stepsNav}>
            {STEP_LABELS.map((label, i) => (
              <button
                key={label}
                onClick={() => { if (i <= step) setStep(i); }}
                className={`${s.stepBtn} ${
                  i === step ? s.stepBtnCurrent :
                  i < step ? `${s.stepBtnDone} ${s.stepBtnClickable}` :
                  s.stepBtnFuture
                }`}
              >
                <div className={`${s.stepDot} ${
                  i === step ? s.stepDotCurrent :
                  i < step ? s.stepDotDone : ""
                }`}>
                  {i < step ? (
                    <svg width="10" height="10" viewBox="0 0 16 16" fill="none">
                      <path d="M3 8l3.5 3.5L13 5" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  ) : (
                    <span>{i + 1}</span>
                  )}
                </div>
                <span>{label}</span>
              </button>
            ))}
          </div>

          {step >= 1 && (
            <div className={s.summaryBox}>
              <div className={s.summaryLabel}>Session</div>
              <div className={s.summaryRow}>
                <span className={s.summaryKey}>Files</span>
                <span className={s.summaryVal}>{files.filter((f) => f.selected).length}</span>
              </div>
              {step >= 2 && (
                <>
                  <div className={s.summaryRow}>
                    <span className={s.summaryKey}>Key</span>
                    <span className={s.summaryVal} style={{ fontFamily: "var(--mono)", fontSize: "0.72rem" }}>
                      {apiKey ? `${apiKey.slice(0, 7)}...${apiKey.slice(-4)}` : "—"}
                    </span>
                  </div>
                  <div className={s.summaryRow}>
                    <span className={s.summaryKey}>Model</span>
                    <span className={s.summaryVal}>{modelName.split(" ").slice(-2).join(" ")}</span>
                  </div>
                </>
              )}
              {step >= 3 && (
                <>
                  <div className={s.summaryRow}>
                    <span className={s.summaryKey}>Scheme</span>
                    <span className={s.summaryVal}>{schemeName}</span>
                  </div>
                  <div className={s.summaryRow}>
                    <span className={s.summaryKey}>Context</span>
                    <span className={s.summaryVal}>{contextWindow} turns</span>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        <div className={s.sidebarFooter}>
          <Link href="/" className={s.footerLink}>Home</Link>
        </div>
      </aside>

      {/* ── MAIN ── */}
      <main className={s.main}>
        <div className={s.mainInner}>
          {/* Header */}
          <div className={s.header}>
            <div className={s.headerLabel}>Step {step + 1} of {STEP_LABELS.length}</div>
            <h1 className={s.headerTitle}>
              {step === 0 && "Upload files"}
              {step === 1 && "Choose model"}
              {step === 2 && "Configure coding"}
              {step === 3 && "Run & review"}
            </h1>
            <p className={s.headerDesc}>
              {step === 0 && "Choose your input type and upload files."}
              {step === 1 && "Select a model for coding. Anthropic models are available today — more providers coming soon."}
              {step === 2 && "Pick a validated coding scheme and set the context window for conversational dynamics."}
              {step === 3 && "Code selected transcripts — each turn is analyzed with a transparent rationale."}
            </p>
          </div>

          {/* ── STEP 0: Upload ── */}
          {step === 0 && (
            <div className={s.fadeIn}>
              {/* Mode selection cards */}
              <div className={s.uploadModeCards}>
                <button
                  className={`${s.uploadModeCard} ${uploadMode === "audio" ? s.uploadModeCardSelected : ""}`}
                  onClick={() => setUploadMode("audio")}
                >
                  <div className={s.uploadModeIcon}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#c45d3e" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" />
                      <path d="M19 10v2a7 7 0 01-14 0v-2" />
                      <line x1="12" y1="19" x2="12" y2="23" />
                      <line x1="8" y1="23" x2="16" y2="23" />
                    </svg>
                  </div>
                  <div>
                    <div className={s.uploadModeName}>Upload audio/video</div>
                    <div className={s.uploadModeDesc}>Upload MP3 or MP4 files. They&apos;ll be sent to ElevenLabs for transcription.</div>
                  </div>
                </button>
                <button
                  className={`${s.uploadModeCard} ${uploadMode === "transcript" ? s.uploadModeCardSelected : ""}`}
                  onClick={() => setUploadMode("transcript")}
                >
                  <div className={s.uploadModeIcon}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#c45d3e" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                      <line x1="16" y1="13" x2="8" y2="13" />
                      <line x1="16" y1="17" x2="8" y2="17" />
                    </svg>
                  </div>
                  <div>
                    <div className={s.uploadModeName}>I already have transcripts</div>
                    <div className={s.uploadModeDesc}>Upload word-level JSON transcripts (e.g. from ElevenLabs).</div>
                  </div>
                </button>
              </div>

              {/* Audio/video dropzone */}
              {uploadMode === "audio" && (
                <>
                  <div
                    className={`${s.dropzone} ${dragOver ? s.dropzoneActive : ""} ${audioFiles.length > 0 ? s.dropzoneHasFiles : ""}`}
                    onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={handleAudioDrop}
                    onClick={() => audioInputRef.current?.click()}
                  >
                    <input
                      ref={audioInputRef}
                      type="file"
                      accept=".mp3,.mp4,.wav"
                      multiple
                      style={{ display: "none" }}
                      onChange={(e) => {
                        if (e.target.files && e.target.files.length > 0) processAudioInput(e.target.files);
                        e.target.value = "";
                      }}
                    />
                    <div className={s.dropIcon}>
                      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#c45d3e" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                        <polyline points="17 8 12 3 7 8" />
                        <line x1="12" y1="3" x2="12" y2="15" />
                      </svg>
                    </div>
                    <div className={s.dropTitle}>
                      {audioFiles.length > 0 ? "Files loaded — drop more to add" : "Drop audio or video files here"}
                    </div>
                    <div className={s.dropSub}>MP3, MP4, or WAV — or click to browse</div>
                    {uploadError && <div className={s.dropError}>{uploadError}</div>}
                  </div>

                  {audioFiles.length > 0 && (
                    <div className={s.fileList}>
                      {audioFiles.map((f, i) => (
                        <div key={`${f.name}-${i}`} className={s.fileItem}>
                          <div className={s.fileIcon}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#c45d3e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" />
                              <path d="M19 10v2a7 7 0 01-14 0v-2" />
                            </svg>
                          </div>
                          <span className={s.fileName}>{f.name}</span>
                          <span className={s.audioFileSize}>{formatFileSize(f.size)}</span>
                          <button
                            className={s.fileRemove}
                            onClick={(e) => { e.stopPropagation(); removeAudioFile(i); }}
                          >
                            x
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className={s.comingSoonNote}>Transcription via ElevenLabs — coming soon</div>
                </>
              )}

              {/* Transcript (JSON) dropzone */}
              {uploadMode === "transcript" && (
                <>
                  <div
                    className={`${s.dropzone} ${dragOver ? s.dropzoneActive : ""} ${hasFiles ? s.dropzoneHasFiles : ""}`}
                    onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".json"
                      multiple
                      style={{ display: "none" }}
                      onChange={(e) => {
                        if (e.target.files && e.target.files.length > 0) processFiles(e.target.files);
                        e.target.value = "";
                      }}
                    />
                    <div className={s.dropIcon}>
                      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#c45d3e" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                        <polyline points="17 8 12 3 7 8" />
                        <line x1="12" y1="3" x2="12" y2="15" />
                      </svg>
                    </div>
                    <div className={s.dropTitle}>
                      {hasFiles ? "Files loaded — drop more to add" : "Drop transcript files here"}
                    </div>
                    <div className={s.dropSub}>Word-level JSON — or click to browse</div>
                    {uploadError && <div className={s.dropError}>{uploadError}</div>}
                  </div>

                  {files.length > 0 && (
                    <div className={s.fileList}>
                      {files.map((f) => (
                        <div key={f.id} className={s.fileItem}>
                          <input
                            type="checkbox"
                            className={s.fileCheckbox}
                            checked={f.selected}
                            onChange={() => toggleFile(f.id)}
                          />
                          <div className={s.fileIcon}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#c45d3e" strokeWidth="2">
                              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                              <polyline points="14 2 14 8 20 8" />
                            </svg>
                          </div>
                          <span className={`${s.fileName} ${!f.selected ? s.fileNameDeselected : ""}`}>
                            {f.fileName}
                          </span>
                          <button
                            className={s.fileRemove}
                            onClick={(e) => { e.stopPropagation(); removeFile(f.id); }}
                          >
                            x
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* ── STEP 1: Model ── */}
          {step === 1 && (
            <div className={`${s.modelList} ${s.fadeIn}`}>
              <div className={s.apiKeySection}>
                {devSignedIn ? (
                  <>
                    <label className={s.apiKeyLabel}>Authentication</label>
                    <div className={s.apiKeyRow}>
                      <span style={{ flex: 1, padding: "0.65rem 0.9rem", borderRadius: 10, border: "1.5px solid #d4edda", background: "#d4edda", fontSize: "0.85rem", fontWeight: 600, color: "#155724" }}>
                        Signed in
                      </span>
                      <button
                        type="button"
                        className={s.apiKeyToggle}
                        onClick={handleDevSignOut}
                        aria-label="Sign out"
                        title="Sign out"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
                          <polyline points="16 17 21 12 16 7" />
                          <line x1="21" y1="12" x2="9" y2="12" />
                        </svg>
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <label className={s.apiKeyLabel}>Password</label>
                    <div className={s.apiKeyRow}>
                      <input
                        type="password"
                        className={s.apiKeyInput}
                        value={devPassword}
                        onChange={(e) => { setDevPassword(e.target.value); setDevAuthError(""); }}
                        onKeyDown={(e) => { if (e.key === "Enter") handleDevSignIn(); }}
                        placeholder="Enter password..."
                        autoComplete="off"
                      />
                      <button
                        type="button"
                        className={s.apiKeyToggle}
                        onClick={handleDevSignIn}
                        aria-label="Sign in"
                        title="Sign in"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="9 18 15 12 9 6" />
                        </svg>
                      </button>
                    </div>
                    {devAuthError && (
                      <p style={{ color: "#c45d3e", fontSize: "0.8rem", marginTop: "0.35rem" }}>{devAuthError}</p>
                    )}
                    <div style={{ margin: "0.75rem 0 0.25rem", fontSize: "0.78rem", color: "#8a8680" }}>
                      Or enter your API key directly:
                    </div>
                    <label className={s.apiKeyLabel}>Anthropic API Key</label>
                    <div className={s.apiKeyRow}>
                      <input
                        type={showKey ? "text" : "password"}
                        className={s.apiKeyInput}
                        value={apiKey}
                        onChange={(e) => handleApiKeyChange(e.target.value)}
                        placeholder="sk-ant-..."
                        spellCheck={false}
                        autoComplete="off"
                      />
                      <button
                        type="button"
                        className={s.apiKeyToggle}
                        onClick={() => setShowKey(!showKey)}
                        aria-label={showKey ? "Hide key" : "Show key"}
                      >
                        {showKey ? (
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94" />
                            <path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19" />
                            <line x1="1" y1="1" x2="23" y2="23" />
                          </svg>
                        ) : (
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                            <circle cx="12" cy="12" r="3" />
                          </svg>
                        )}
                      </button>
                    </div>
                  </>
                )}
              </div>

              {MODEL_PROVIDERS.map((provider) => (
                <div key={provider.id} className={s.providerSection}>
                  <div className={s.providerHeader}>
                    <div
                      className={s.providerIconWrap}
                      style={{ background: `${provider.accent}1a`, color: provider.accent }}
                    >
                      <ProviderIcon provider={provider.id} />
                    </div>
                    <div className={s.providerName}>{provider.name}</div>
                    {provider.comingSoon && (
                      <span className={s.providerSoonBadge}>Coming soon</span>
                    )}
                  </div>
                  <div className={s.providerModels}>
                    {provider.models.map((m) => {
                      const isSelected = selectedModel === m.id;
                      const disabled = !!provider.comingSoon;
                      return (
                        <button
                          key={m.id}
                          className={`${s.modelCard} ${isSelected ? s.modelCardSelected : ""} ${disabled ? s.modelCardDisabled : ""}`}
                          onClick={() => { if (!disabled) setSelectedModel(m.id); }}
                          disabled={disabled}
                        >
                          <div className={s.modelRadio}>
                            <div className={`${s.modelRadioInner} ${isSelected ? s.modelRadioSelected : ""}`} />
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                              <span className={s.modelName}>{m.name}</span>
                              {m.badge && <span className={s.modelBadge}>{m.badge}</span>}
                            </div>
                            <div className={s.modelDesc}>{m.desc}</div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── STEP 2: Configure ── */}
          {step === 2 && (
            <div className={s.fadeIn}>
              <div className={s.configLabel}>Coding scheme</div>
              <div className={s.schemesGrid}>
                {CODING_SCHEMES.filter((sc) => sc.id !== "custom").map((sc) => (
                  <button
                    key={sc.id}
                    className={`${s.schemeCard} ${schemeId === sc.id ? s.schemeCardSelected : ""} ${sc.comingSoon ? s.schemeCardDisabled : ""}`}
                    onClick={() => { if (!sc.comingSoon) handleSchemeChange(sc.id); }}
                    disabled={!!sc.comingSoon}
                  >
                    <div className={s.schemeAbbr}>{sc.label}</div>
                    <div className={s.schemeFull}>{sc.description}</div>
                    {sc.badge && <span className={s.schemeBadge}>{sc.badge}</span>}
                    {sc.comingSoon && <span className={s.comingSoonBadge}>Coming soon</span>}
                  </button>
                ))}
                <button
                  className={`${s.schemeCard} ${s.schemeCustom} ${schemeId === "custom" ? s.schemeCardSelected : ""}`}
                  onClick={() => handleSchemeChange("custom")}
                >
                  <div className={s.customPlus}>+</div>
                  <div className={s.schemeDesc} style={{ textAlign: "center" }}>Custom scheme</div>
                </button>
              </div>

              {activeScheme && !activeScheme.comingSoon && (
                <div className={s.categoryEditorWrap}>
                  <div className={s.categoryEditorLabel}>
                    {schemeId === "custom" ? "Define categories" : "Edit categories"}
                  </div>
                  <CategoryEditor
                    categories={categories}
                    onChange={setCategories}
                    rules={customRules}
                    onRulesChange={setCustomRules}
                  />
                </div>
              )}

              <div className={s.sliderSection}>
                <div className={s.configLabel}>Context window</div>
                <div className={s.configDesc}>Number of prior turns included for each coding decision.</div>
                <div className={s.sliderRow}>
                  <input
                    type="range"
                    min={0}
                    max={20}
                    value={contextWindow}
                    onChange={(e) => setContextWindow(+e.target.value)}
                    className={s.slider}
                  />
                  <div className={s.sliderVal}>{contextWindow} turn{contextWindow !== 1 ? "s" : ""}</div>
                </div>
              </div>
            </div>
          )}

          {/* ── STEP 3: Run ── */}
          {step === 3 && (
            <div className={s.fadeIn}>
              <button
                className={s.codeBtn}
                disabled={!anySelected || isAnyCoding || schemeId === null || selectedModel === ""}
                onClick={handleCode}
              >
                {isAnyCoding ? "Coding..." : stepDone[3] ? "Recode Turns" : "Code Turns"}
              </button>

              {(schemeId === null || selectedModel === "") && (
                <div className={s.codeBtnHint}>
                  {schemeId === null && selectedModel === ""
                    ? "Select a model and a coding scheme first."
                    : selectedModel === ""
                    ? "Select a model first."
                    : "Select a coding scheme first."}
                </div>
              )}

              {/* Per-file progress */}
              {hasFiles && files.some((f) => f.selected && f.status !== "pending") && (
                <div className={s.progressSection}>
                  {files.filter((f) => f.selected).map((f) => {
                    const pct = f.progress.total > 0 ? (f.progress.completed / f.progress.total) * 100 : 0;
                    return (
                      <div key={f.id} className={s.progressFileBlock}>
                        <div className={s.progressFileHeader}>
                          <span className={s.progressFileName}>
                            {f.fileName}
                          </span>
                          {(f.status === "coding" || f.status === "done") && (
                            <span className={s.progressCount}>
                              {f.progress.completed} / {f.progress.total}
                            </span>
                          )}
                        </div>
                        {(f.status === "coding" || f.status === "done") && (
                          <div className={s.progressBar}>
                            <div className={s.progressFill} style={{ width: `${pct}%` }} />
                          </div>
                        )}
                        <div className={s.progressStatus}>
                          {f.status === "coding" && (
                            <span className={s.statusCoding}><span className={s.liveDot} /> Coding...</span>
                          )}
                          {f.status === "done" && (
                            <span className={s.statusDone}>Complete</span>
                          )}
                          {f.status === "error" && (
                            <span className={s.statusError}>{f.error}</span>
                          )}
                          {f.status === "pending" && (
                            <span className={s.statusPending}>Pending</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Export All */}
              {showExportAll && (
                <div className={s.exportAllRow}>
                  <button className={s.exportBtn} onClick={handleExportAll}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                      <polyline points="7 10 12 15 17 10" />
                      <line x1="12" y1="15" x2="12" y2="3" />
                    </svg>
                    Export All ({doneFiles.length} files)
                  </button>
                </div>
              )}

              {/* View Logs */}
              {apiLogs.length > 0 && (
                <div style={{ marginBottom: "0.75rem" }}>
                  <button
                    type="button"
                    onClick={() => window.open("/logs", "_blank")}
                    style={{
                      background: "none", border: "1px solid #e8e4de", borderRadius: 8,
                      padding: "0.4rem 0.8rem", fontSize: "0.78rem", color: "#8a8680",
                      cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "0.35rem",
                    }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                      <line x1="16" y1="13" x2="8" y2="13" />
                      <line x1="16" y1="17" x2="8" y2="17" />
                    </svg>
                    View API Logs ({apiLogs.length})
                  </button>
                </div>
              )}

              {/* Results table per file */}
              {files.filter((f) => f.selected && f.codedTurns.length > 0).map((f) => {
                const sorted = [...f.codedTurns].sort((a, b) => a.turnNumber - b.turnNumber);
                const multipleFiles = files.filter((ff) => ff.selected).length > 1;
                const isOpen = openResults[f.id] !== false; // default open
                return (
                  <div key={f.id} className={s.resultsBlock}>
                    <div className={s.resultsBlockHeader}>
                      <button
                        className={s.resultsToggle}
                        onClick={() => toggleResultsOpen(f.id)}
                      >
                        <svg
                          width="14" height="14" viewBox="0 0 24 24" fill="none"
                          stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                          className={`${s.chevron} ${isOpen ? s.chevronOpen : ""}`}
                        >
                          <polyline points="9 18 15 12 9 6" />
                        </svg>
                        <div className={s.resultsBlockTitle}>
                          {multipleFiles && <span className={s.resultsBlockFile}>{f.fileName}</span>}
                          <span className={s.resultsBlockCount}>{sorted.length} turn{sorted.length !== 1 ? "s" : ""} coded</span>
                        </div>
                      </button>
                      {f.status === "done" && <ExportButton codedTurns={sorted} />}
                    </div>
                    {isOpen && (
                      <TooltipProvider delay={100}>
                        <div className={s.tableWrap}>
                          <table className={s.table}>
                            <thead>
                              <tr className={s.tableHeadRow}>
                                <th className={s.th}>#</th>
                                <th className={s.th}>Speaker</th>
                                <th className={`${s.th} ${s.thText}`}>Text</th>
                                <th className={s.th}>Category</th>
                                <th className={`${s.th} ${s.thRationale}`}>Rationale</th>
                              </tr>
                            </thead>
                            <tbody>
                              {sorted.map((turn) => {
                                const speakerClass = turn.speaker.includes("0") || turn.speaker.toLowerCase().includes("a")
                                  ? s.speakerA : s.speakerB;
                                return (
                                  <tr key={turn.turnNumber} className={s.tableRow}>
                                    <td className={s.tdNum}>{turn.turnNumber}</td>
                                    <td className={s.tdSpeaker}>
                                      <span className={`${s.speakerTag} ${speakerClass}`}>{turn.speaker}</span>
                                    </td>
                                    <td className={s.tdText}>
                                      <TooltipRoot>
                                        <TooltipTrigger className={s.truncCell}>{turn.text}</TooltipTrigger>
                                        <TooltipContent className={s.tooltipContent}>{turn.text}</TooltipContent>
                                      </TooltipRoot>
                                    </td>
                                    <td className={s.tdCategory}>
                                      <span className={s.codeTag}>{turn.category}</span>
                                    </td>
                                    <td className={s.tdRationale}>
                                      <TooltipRoot>
                                        <TooltipTrigger className={s.truncCell}>{turn.rationale}</TooltipTrigger>
                                        <TooltipContent className={s.tooltipContent}>{turn.rationale}</TooltipContent>
                                      </TooltipRoot>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </TooltipProvider>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* ── Bottom Nav ── */}
          <div className={s.nav}>
            <button
              className={`${s.navBtn} ${s.navBack}`}
              disabled={step === 0}
              onClick={() => setStep(Math.max(0, step - 1))}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
              Back
            </button>
            <div className={s.navStepLabel}>{step + 1} / {STEP_LABELS.length}</div>
            {step < 3 ? (
              <button
                className={`${s.navBtn} ${s.navNext}`}
                disabled={!canAdvance()}
                onClick={() => setStep(step + 1)}
              >
                Next
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </button>
            ) : (
              <div />
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
