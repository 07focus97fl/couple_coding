"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { FileUpload } from "./components/FileUpload";
import { ModelSelector } from "./components/ModelSelector";
import { CodingSchemeSelector } from "./components/CodingSchemeSelector";
import { ResultsTable } from "./components/ResultsTable";
import { CollapsibleSection } from "./components/CollapsibleSection";
import { ExportButton } from "./components/ExportButton";
import { parseTranscript } from "@/lib/parse-transcript";
import {
  RawTranscript,
  TranscriptFile,
  CategoryDefinition,
  CODING_SCHEMES,
  DEFAULT_CONTEXT_WINDOW,
} from "@/lib/types";

export default function CodingPage() {
  const [files, setFiles] = useState<TranscriptFile[]>([]);
  const [selectedModel, setSelectedModel] = useState("claude-sonnet-4-6");
  const [schemeId, setSchemeId] = useState<string | null>(null);
  const [categories, setCategories] = useState<CategoryDefinition[]>([]);
  const [contextWindow, setContextWindow] = useState(DEFAULT_CONTEXT_WINDOW);

  const hasFiles = files.length > 0;
  const isAnyCoding = files.some((f) => f.status === "coding");
  const anySelected = files.some((f) => f.selected);
  const allSelectedDone = anySelected && files.filter((f) => f.selected).every((f) => f.status === "done");

  const handleSchemeChange = useCallback((id: string) => {
    setSchemeId(id);
    const scheme = CODING_SCHEMES.find((s) => s.id === id);
    if (scheme) setCategories(scheme.categories);
  }, []);

  const STEPS = ["upload", "model", "configure", "run"] as const;
  type Step = (typeof STEPS)[number];
  const [activeTab, setActiveTab] = useState<Step>("upload");
  const stepIndex = STEPS.indexOf(activeTab);
  const isFirst = stepIndex === 0;
  const isLast = stepIndex === STEPS.length - 1;

  const handleFilesLoaded = useCallback(
    (loaded: Array<{ fileName: string; transcript: RawTranscript }>) => {
      const newFiles: TranscriptFile[] = loaded.map((f) => ({
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
    },
    []
  );

  const toggleFile = useCallback((id: string) => {
    setFiles((prev) =>
      prev.map((f) => (f.id === id ? { ...f, selected: !f.selected } : f))
    );
  }, []);

  const handleCode = async () => {
    if (!hasFiles) return;

    const filesToCode = files.filter((f) => f.selected);
    for (const file of filesToCode) {
      // Parse turns lazily on first code
      const turns = file.turns.length > 0
        ? file.turns
        : parseTranscript(file.rawTranscript.words);

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
            contextWindow,
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
                  prev.map((f) =>
                    f.id === file.id
                      ? { ...f, codedTurns: [...f.codedTurns, codedTurn] }
                      : f
                  )
                );
              } else if (eventType === "progress") {
                const progress = JSON.parse(data);
                setFiles((prev) =>
                  prev.map((f) =>
                    f.id === file.id ? { ...f, progress } : f
                  )
                );
              } else if (eventType === "error") {
                const { message } = JSON.parse(data);
                setFiles((prev) =>
                  prev.map((f) =>
                    f.id === file.id
                      ? { ...f, status: "error" as const, error: message }
                      : f
                  )
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
              : f
          )
        );
      } catch (err) {
        setFiles((prev) =>
          prev.map((f) =>
            f.id === file.id
              ? {
                  ...f,
                  status: "error" as const,
                  error: err instanceof Error ? err.message : "Unknown error",
                }
              : f
          )
        );
      }
    }
  };

  const filesWithResults = files.filter((f) => f.codedTurns.length > 0);
  const multipleResults = filesWithResults.length > 1;

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <div className="h-1 bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500" />

      <div className="max-w-5xl mx-auto px-6 py-12">
        <header className="mb-12">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-600 dark:text-amber-400 mb-2">
              Research Tool
            </p>
            <h1 className="text-3xl font-bold tracking-tight mb-2">
              Couple Conversation Coder
            </h1>
            <p className="text-muted-foreground text-sm max-w-lg">
              Upload word-level transcripts, configure valence categories, and
              automatically code each speaking turn.
            </p>
          </div>
        </header>

        <Tabs
          value={activeTab}
          onValueChange={(val) => setActiveTab(val as Step)}
          className="mb-10"
        >
          <TabsList className="h-auto p-1">
            <TabsTrigger value="upload" className="px-4 py-2">1. Upload</TabsTrigger>
            <TabsTrigger value="model" className="px-4 py-2">2. Model</TabsTrigger>
            <TabsTrigger value="configure" className="px-4 py-2">3. Configure</TabsTrigger>
            <TabsTrigger value="run" className="px-4 py-2">4. Run</TabsTrigger>
          </TabsList>

          <TabsContent value="upload" className="mt-6">
            <FileUpload onFilesLoaded={handleFilesLoaded} hasFiles={hasFiles} />
            {hasFiles && (
              <div className="mt-4 space-y-2">
                <p className="text-sm text-muted-foreground">
                  <span className="font-semibold text-foreground">{files.length}</span> file{files.length !== 1 ? "s" : ""} uploaded
                </p>
                <ul className="space-y-1">
                  {files.map((f) => (
                    <li key={f.id} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={f.selected}
                        onChange={() => toggleFile(f.id)}
                        className="h-4 w-4 rounded border-muted-foreground/50 accent-primary cursor-pointer"
                      />
                      <span className={f.selected ? "font-medium" : "font-medium text-muted-foreground"}>{f.fileName}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </TabsContent>

          <TabsContent value="model" className="mt-6">
            <div className="max-w-sm">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">
                Select Model
              </label>
              <ModelSelector value={selectedModel} onValueChange={setSelectedModel} />
            </div>
          </TabsContent>

          <TabsContent value="configure" className="mt-6">
            <div className="space-y-6 max-w-2xl">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">
                  Coding Scheme
                </label>
                <CodingSchemeSelector
                  schemeId={schemeId}
                  onSchemeChange={handleSchemeChange}
                  categories={categories}
                  onCategoriesChange={setCategories}
                />
              </div>
              <div>
                <label
                  htmlFor="contextWindow"
                  className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block"
                >
                  Context Window
                </label>
                <Input
                  id="contextWindow"
                  type="number"
                  min={0}
                  max={20}
                  value={contextWindow}
                  onChange={(e) => {
                    const num = parseInt(e.target.value, 10);
                    if (!isNaN(num) && num >= 0) setContextWindow(num);
                  }}
                  className="max-w-[8rem]"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Number of prior turns to include as context for each coding decision.
                </p>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="run" className="mt-6">
            <div className="space-y-4">
              <div className="max-w-sm">
                <Button
                  className="w-full"
                  size="lg"
                  disabled={!anySelected || isAnyCoding || schemeId === null}
                  onClick={handleCode}
                >
                  {isAnyCoding ? "Coding..." : allSelectedDone ? "Recode Turns" : "Code Turns"}
                </Button>

                {schemeId === null && (
                  <p className="text-sm text-muted-foreground mt-2">
                    Select a coding scheme in Configure first.
                  </p>
                )}
              </div>

              {hasFiles && (isAnyCoding || files.some((f) => f.selected && (f.status === "done" || f.status === "error"))) && (
                <div className="space-y-3 mt-4">
                  {files.filter((f) => f.selected).map((f) => {
                    const pct = f.progress.total > 0 ? (f.progress.completed / f.progress.total) * 100 : 0;
                    const statusLabel =
                      f.status === "pending" ? "Pending" :
                      f.status === "coding" ? "Coding" :
                      f.status === "done" ? "Done" : "Error";
                    const statusColor =
                      f.status === "pending" ? "bg-muted text-muted-foreground" :
                      f.status === "coding" ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400" :
                      f.status === "done" ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400" :
                      "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400";

                    return (
                      <div key={f.id} className="space-y-1">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">{f.fileName}</span>
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor}`}>
                              {statusLabel}
                            </span>
                          </div>
                          {(f.status === "coding" || f.status === "done") && (
                            <span className="text-sm text-muted-foreground font-mono">
                              {f.progress.completed} / {f.progress.total}
                            </span>
                          )}
                        </div>
                        {(f.status === "coding" || f.status === "done") && (
                          <Progress value={pct} className="h-2" />
                        )}
                        {f.error && (
                          <p className="text-sm text-destructive font-medium">{f.error}</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </TabsContent>

          <div className="flex items-center justify-between mt-6 pt-4 border-t">
            <Button
              variant="outline"
              size="sm"
              disabled={isFirst}
              onClick={() => setActiveTab(STEPS[stepIndex - 1])}
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Back
            </Button>
            <p className="text-xs text-muted-foreground">
              Step {stepIndex + 1} of {STEPS.length}
            </p>
            <Button
              variant="outline"
              size="sm"
              disabled={isLast}
              onClick={() => setActiveTab(STEPS[stepIndex + 1])}
            >
              Next
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </Tabs>

        {filesWithResults.length > 0 && (
          <div className="space-y-4">
            {filesWithResults.map((f) => {
              const sorted = [...f.codedTurns].sort((a, b) => a.turnNumber - b.turnNumber);
              return (
                <CollapsibleSection
                  key={f.id}
                  defaultOpen={!multipleResults}
                  title={
                    <span>
                      {f.fileName}{" "}
                      <span className="text-muted-foreground font-normal text-sm">
                        ({sorted.length} turns)
                      </span>
                    </span>
                  }
                  action={<ExportButton codedTurns={sorted} />}
                >
                  <ResultsTable codedTurns={sorted} />
                </CollapsibleSection>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
