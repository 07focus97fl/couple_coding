"use client";

import { useState, useCallback, useRef } from "react";
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
  DEFAULT_CONTEXT_WINDOW,
} from "@/lib/types";
import s from "./coding.module.css";

const STEP_LABELS = ["Upload", "Model", "Configure", "Run"] as const;

const MODELS = [
  { id: "claude-sonnet-4-6", name: "Claude Sonnet 4.6", desc: "Fast & capable — ideal for most coding tasks", badge: "Recommended" },
  { id: "claude-opus-4-6", name: "Claude Opus 4.6", desc: "Highest accuracy for nuanced or ambiguous turns", badge: null },
  { id: "claude-haiku-4-5-20251001", name: "Claude Haiku 4.5", desc: "Fastest — good for simple binary schemes", badge: null },
];

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
  const [files, setFiles] = useState<TranscriptFile[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState("");
  const [schemeId, setSchemeId] = useState<string | null>(null);
  const [categories, setCategories] = useState<CategoryDefinition[]>([]);
  const [contextWindow, setContextWindow] = useState(DEFAULT_CONTEXT_WINDOW);
  const [openResults, setOpenResults] = useState<Record<string, boolean>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  const hasFiles = files.length > 0;
  const isAnyCoding = files.some((f) => f.status === "coding");
  const anySelected = files.some((f) => f.selected);

  const canAdvance = () => {
    if (step === 0) return hasFiles;
    if (step === 1) return selectedModel !== "";
    if (step === 2) return schemeId !== null;
    return true;
  };

  const stepDone = [
    hasFiles,
    selectedModel !== "",
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

  const removeFile = (id: string) => setFiles((prev) => prev.filter((f) => f.id !== id));
  const toggleFile = (id: string) => setFiles((prev) => prev.map((f) => f.id === id ? { ...f, selected: !f.selected } : f));

  // ── Scheme handling ──
  const handleSchemeChange = useCallback((id: string) => {
    setSchemeId(id);
    const scheme = CODING_SCHEMES.find((sc) => sc.id === id);
    if (scheme) setCategories(scheme.categories);
  }, []);

  // ── Coding ──
  const handleCode = async () => {
    if (!hasFiles) return;
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
          body: JSON.stringify({ turns, model: selectedModel, categories, contextWindow }),
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

  const filesWithResults = files.filter((f) => f.codedTurns.length > 0);
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
                <div className={s.summaryRow}>
                  <span className={s.summaryKey}>Model</span>
                  <span className={s.summaryVal}>{modelName.split(" ").slice(-2).join(" ")}</span>
                </div>
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
              {step === 0 && "Upload transcript"}
              {step === 1 && "Choose model"}
              {step === 2 && "Configure coding"}
              {step === 3 && "Run & review"}
            </h1>
            <p className={s.headerDesc}>
              {step === 0 && "Drop your word-level JSON transcript. Speaker turns will be segmented automatically."}
              {step === 1 && "Select the Claude model for coding. Higher-tier models give more nuanced rationales."}
              {step === 2 && "Pick a validated coding scheme and set the context window for conversational dynamics."}
              {step === 3 && "Code selected transcripts — each turn is analyzed with a transparent rationale."}
            </p>
          </div>

          {/* ── STEP 0: Upload ── */}
          {step === 0 && (
            <div className={s.fadeIn}>
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
            </div>
          )}

          {/* ── STEP 1: Model ── */}
          {step === 1 && (
            <div className={`${s.modelList} ${s.fadeIn}`}>
              {MODELS.map((m) => (
                <button
                  key={m.id}
                  className={`${s.modelCard} ${selectedModel === m.id ? s.modelCardSelected : ""}`}
                  onClick={() => setSelectedModel(m.id)}
                >
                  <div className={s.modelRadio}>
                    <div className={`${s.modelRadioInner} ${selectedModel === m.id ? s.modelRadioSelected : ""}`} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <span className={s.modelName}>{m.name}</span>
                      {m.badge && <span className={s.modelBadge}>{m.badge}</span>}
                    </div>
                    <div className={s.modelDesc}>{m.desc}</div>
                  </div>
                </button>
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
                  <CategoryEditor categories={categories} onChange={setCategories} />
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
                      <TooltipProvider>
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
                                      <TooltipRoot delay={100}>
                                        <TooltipTrigger className={s.truncCell}>{turn.text}</TooltipTrigger>
                                        <TooltipContent className={s.tooltipContent}>{turn.text}</TooltipContent>
                                      </TooltipRoot>
                                    </td>
                                    <td className={s.tdCategory}>
                                      <span className={s.codeTag}>{turn.category}</span>
                                    </td>
                                    <td className={s.tdRationale}>
                                      <TooltipRoot delay={100}>
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
