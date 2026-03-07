"use client";

import { useCallback, useState, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { RawTranscript } from "@/lib/types";

interface FileUploadProps {
  onTranscriptLoaded: (transcript: RawTranscript) => void;
}

export function FileUpload({ onTranscriptLoaded }: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const processFile = useCallback(
    (file: File) => {
      setError(null);
      if (!file.name.endsWith(".json")) {
        setError("Please upload a JSON file.");
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = JSON.parse(e.target?.result as string) as RawTranscript;
          if (!data.words || !Array.isArray(data.words)) {
            setError("Invalid transcript: missing 'words' array.");
            return;
          }
          setFileName(file.name);
          onTranscriptLoaded(data);
        } catch {
          setError("Failed to parse JSON file.");
        }
      };
      reader.readAsText(file);
    },
    [onTranscriptLoaded]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) processFile(file);
    },
    [processFile]
  );

  return (
    <Card
      className={`relative cursor-pointer border-2 border-dashed transition-all duration-200 ${
        isDragging
          ? "border-primary bg-primary/5 scale-[1.01]"
          : fileName
            ? "border-emerald-500/50 bg-emerald-50/50 dark:bg-emerald-950/20"
            : "border-muted-foreground/25 hover:border-muted-foreground/50"
      }`}
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
    >
      <CardContent className="flex flex-col items-center justify-center py-10 gap-3">
        <div className="text-4xl opacity-60">{fileName ? "\u2705" : "\uD83D\uDCC1"}</div>
        {fileName ? (
          <div className="text-center">
            <p className="font-medium text-emerald-700 dark:text-emerald-400">{fileName}</p>
            <p className="text-sm text-muted-foreground mt-1">Click or drop to replace</p>
          </div>
        ) : (
          <div className="text-center">
            <p className="font-medium">Drop your transcript JSON here</p>
            <p className="text-sm text-muted-foreground mt-1">or click to browse</p>
          </div>
        )}
        {error && <p className="text-sm text-destructive font-medium">{error}</p>}
        <input
          ref={inputRef}
          type="file"
          accept=".json"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) processFile(file);
          }}
        />
      </CardContent>
    </Card>
  );
}
