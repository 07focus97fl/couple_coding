"use client";

import { useCallback, useState, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { RawTranscript } from "@/lib/types";

interface FileUploadProps {
  onFilesLoaded: (files: Array<{ fileName: string; transcript: RawTranscript }>) => void;
  hasFiles: boolean;
}

function readFile(file: File): Promise<{ fileName: string; transcript: RawTranscript }> {
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

export function FileUpload({ onFilesLoaded, hasFiles }: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const processFiles = useCallback(
    async (fileList: FileList) => {
      setError(null);
      try {
        const results = await Promise.all(Array.from(fileList).map(readFile));
        onFilesLoaded(results);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to read files.");
      }
    },
    [onFilesLoaded]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      if (e.dataTransfer.files.length > 0) processFiles(e.dataTransfer.files);
    },
    [processFiles]
  );

  return (
    <Card
      className={`relative cursor-pointer border-2 border-dashed transition-all duration-200 ${
        isDragging
          ? "border-primary bg-primary/5 scale-[1.01]"
          : hasFiles
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
        <div className="text-4xl opacity-60">{hasFiles ? "\u2705" : "\uD83D\uDCC1"}</div>
        {hasFiles ? (
          <div className="text-center">
            <p className="font-medium text-emerald-700 dark:text-emerald-400">Files loaded</p>
            <p className="text-sm text-muted-foreground mt-1">Click or drop to add more</p>
          </div>
        ) : (
          <div className="text-center">
            <p className="font-medium">Drop transcript JSON files here</p>
            <p className="text-sm text-muted-foreground mt-1">or click to browse</p>
          </div>
        )}
        {error && <p className="text-sm text-destructive font-medium">{error}</p>}
        <input
          ref={inputRef}
          type="file"
          accept=".json"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0) processFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </CardContent>
    </Card>
  );
}
