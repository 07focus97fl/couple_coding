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
import { parseTranscript } from "@/lib/parse-transcript";
import {
  RawTranscript,
  SpeakingTurn,
  CodedTurn,
  CategoryDefinition,
  CODING_SCHEMES,
  DEFAULT_CONTEXT_WINDOW,
} from "@/lib/types";

export default function CodingPage() {
  const [turns, setTurns] = useState<SpeakingTurn[]>([]);
  const [selectedModel, setSelectedModel] = useState("claude-sonnet-4-6");
  const [codedTurns, setCodedTurns] = useState<CodedTurn[]>([]);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState({ completed: 0, total: 0 });
  const [error, setError] = useState<string | null>(null);
  const [schemeId, setSchemeId] = useState<string | null>(null);
  const [categories, setCategories] = useState<CategoryDefinition[]>([]);
  const [contextWindow, setContextWindow] = useState(DEFAULT_CONTEXT_WINDOW);

  const handleSchemeChange = useCallback(
    (id: string) => {
      setSchemeId(id);
      const scheme = CODING_SCHEMES.find((s) => s.id === id);
      if (scheme) {
        setCategories(scheme.categories);
      }
    },
    []
  );

  const STEPS = ["upload", "model", "configure", "run"] as const;
  type Step = (typeof STEPS)[number];
  const [activeTab, setActiveTab] = useState<Step>("upload");
  const stepIndex = STEPS.indexOf(activeTab);
  const isFirst = stepIndex === 0;
  const isLast = stepIndex === STEPS.length - 1;

  const handleTranscriptLoaded = useCallback((transcript: RawTranscript) => {
    const parsed = parseTranscript(transcript.words);
    setTurns(parsed);
    setCodedTurns([]);
    setError(null);
  }, []);

  const handleCode = async () => {
    if (turns.length === 0) return;
    setLoading(true);
    setCodedTurns([]);
    setError(null);
    setProgress({ completed: 0, total: turns.length });

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
              setCodedTurns((prev) => [...prev, codedTurn]);
            } else if (eventType === "progress") {
              setProgress(JSON.parse(data));
            } else if (eventType === "error") {
              const { message } = JSON.parse(data);
              setError(message);
            }
            eventType = "";
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  const progressPercent =
    progress.total > 0 ? (progress.completed / progress.total) * 100 : 0;

  const sortedCodedTurns = [...codedTurns].sort((a, b) => a.turnNumber - b.turnNumber);

  return (
    <div className="min-h-screen bg-[var(--background)]">
      {/* Subtle top accent line */}
      <div className="h-1 bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500" />

      <div className="max-w-5xl mx-auto px-6 py-12">
        {/* Header */}
        <header className="mb-12">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-600 dark:text-amber-400 mb-2">
              Research Tool
            </p>
            <h1 className="text-3xl font-bold tracking-tight mb-2">
              Couple Conversation Coder
            </h1>
            <p className="text-muted-foreground text-sm max-w-lg">
              Upload a word-level transcript, configure valence categories, and
              automatically code each speaking turn.
            </p>
          </div>
        </header>

        {/* Tab-based pipeline */}
        <Tabs
          value={activeTab}
          onValueChange={(val) => setActiveTab(val as Step)}
          className="mb-10"
        >
          <TabsList className="h-auto p-1">
            <TabsTrigger value="upload" className="px-4 py-2">
              1. Upload
            </TabsTrigger>
            <TabsTrigger value="model" className="px-4 py-2">
              2. Model
            </TabsTrigger>
            <TabsTrigger value="configure" className="px-4 py-2">
              3. Configure
            </TabsTrigger>
            <TabsTrigger value="run" className="px-4 py-2">
              4. Run
            </TabsTrigger>
          </TabsList>

          <TabsContent value="upload" className="mt-6">
            <FileUpload onTranscriptLoaded={handleTranscriptLoaded} />
            {turns.length > 0 && (
              <p className="text-sm text-muted-foreground mt-3">
                Parsed{" "}
                <span className="font-semibold text-foreground">
                  {turns.length}
                </span>{" "}
                speaking turns
              </p>
            )}
          </TabsContent>

          <TabsContent value="model" className="mt-6">
            <div className="max-w-sm">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">
                Select Model
              </label>
              <ModelSelector
                value={selectedModel}
                onValueChange={setSelectedModel}
              />
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
            <div className="space-y-4 max-w-sm">
              <Button
                className="w-full"
                size="lg"
                disabled={turns.length === 0 || loading || schemeId === null}
                onClick={handleCode}
              >
                {loading ? "Coding..." : "Code Turns"}
              </Button>

              {schemeId === null && (
                <p className="text-sm text-muted-foreground">
                  Select a coding scheme in Configure first.
                </p>
              )}

              {loading && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-medium">Coding exchanges&hellip;</p>
                    <p className="text-sm text-muted-foreground font-mono">
                      {progress.completed} / {progress.total}
                    </p>
                  </div>
                  <Progress value={progressPercent} className="h-2" />
                </div>
              )}

              {error && (
                <p className="text-sm text-destructive font-medium">{error}</p>
              )}
            </div>
          </TabsContent>

          {/* Navigation buttons */}
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

        {/* Results */}
        {sortedCodedTurns.length > 0 && (
          <ResultsTable codedTurns={sortedCodedTurns} />
        )}
      </div>
    </div>
  );
}
