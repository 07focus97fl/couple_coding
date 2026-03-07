"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { FileUpload } from "./components/FileUpload";
import { ModelSelector } from "./components/ModelSelector";
import { ResultsTable } from "./components/ResultsTable";
import { parseTranscript } from "@/lib/parse-transcript";
import { RawTranscript, SpeakingTurn, CodedTurn, DEFAULT_WORD_COUNT_THRESHOLD } from "@/lib/types";

export default function CodingPage() {
  const [turns, setTurns] = useState<SpeakingTurn[]>([]);
  const [selectedModel, setSelectedModel] = useState("claude-sonnet-4-6");
  const [codedTurns, setCodedTurns] = useState<CodedTurn[]>([]);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState({ completed: 0, total: 0 });
  const [error, setError] = useState<string | null>(null);
  const [wordCountThreshold, setWordCountThreshold] = useState(DEFAULT_WORD_COUNT_THRESHOLD);

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
        body: JSON.stringify({ turns, model: selectedModel, threshold: wordCountThreshold }),
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
            if (eventType === "batch") {
              const { codedTurns: batch } = JSON.parse(data);
              setCodedTurns((prev) => [...prev, ...batch]);
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
              Upload a word-level transcript, select a model, and automatically
              code each speaking turn.
            </p>
          </div>
        </header>

        {/* Pipeline steps */}
        <div className="grid gap-6 md:grid-cols-[1fr_280px] mb-10">
          {/* Upload */}
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">
              1 &middot; Transcript
            </label>
            <FileUpload onTranscriptLoaded={handleTranscriptLoaded} />
            {turns.length > 0 && (
              <p className="text-sm text-muted-foreground mt-2">
                Parsed{" "}
                <span className="font-semibold text-foreground">
                  {turns.length}
                </span>{" "}
                speaking turns
              </p>
            )}
          </div>

          {/* Model + Configure + Action */}
          <div className="flex flex-col gap-4">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">
                2 &middot; Model
              </label>
              <ModelSelector
                value={selectedModel}
                onValueChange={setSelectedModel}
              />
            </div>

            <div>
              <label
                htmlFor="threshold"
                className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block"
              >
                3 &middot; Configure
              </label>
              <Input
                id="threshold"
                type="number"
                min={1}
                value={wordCountThreshold}
                onChange={(e) => {
                  const num = parseInt(e.target.value, 10);
                  if (!isNaN(num) && num > 0) setWordCountThreshold(num);
                }}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Word count threshold for &quot;Long Turn&quot;
              </p>
            </div>

            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">
                4 &middot; Run
              </label>
              <Button
                className="w-full"
                size="lg"
                disabled={turns.length === 0 || loading}
                onClick={handleCode}
              >
                {loading ? "Coding..." : "Code Turns"}
              </Button>
            </div>
          </div>
        </div>

        {/* Progress */}
        {loading && (
          <Card className="mb-8 border-amber-200 dark:border-amber-900/50">
            <CardContent className="py-5">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium">Coding exchanges&hellip;</p>
                <p className="text-sm text-muted-foreground font-mono">
                  {progress.completed} / {progress.total}
                </p>
              </div>
              <Progress value={progressPercent} className="h-2" />
            </CardContent>
          </Card>
        )}

        {/* Error */}
        {error && (
          <Card className="mb-8 border-destructive/50 bg-destructive/5">
            <CardContent className="py-4">
              <p className="text-sm text-destructive font-medium">{error}</p>
            </CardContent>
          </Card>
        )}

        {/* Results */}
        {codedTurns.length > 0 && <ResultsTable codedTurns={codedTurns} />}
      </div>
    </div>
  );
}
