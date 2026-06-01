"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface FormatInfoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function FormatInfoDialog({ open, onOpenChange }: FormatInfoDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Accepted formats</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-2 text-sm">
          {/* Audio */}
          <div className="space-y-1.5">
            <div className="font-medium">Audio — MP3 · MP4 · WAV</div>
            <p className="text-muted-foreground">
              If you wish to input audio files, these can be MP3, MP4, or WAV.
              They&apos;ll be transcribed with ElevenLabs&apos;{" "}
              <span className="font-medium text-foreground">Scribe v1</span>{" "}
              transcription model with two-speaker diarization and word-level
              timestamps. In other words, the transcript will assume two
              speakers and be broken down into <code>speaker_0</code> and{" "}
              <code>speaker_1</code>, and retain the precise start and end time
              of each word. These transcripts are made available to you in full,
              in addition to the communication codes.{" "}
              <span className="italic">Scribe v2 support is coming soon.</span>
            </p>
          </div>

          {/* JSON */}
          <div className="space-y-1.5">
            <div className="font-medium">Transcript — JSON</div>
            <p className="text-muted-foreground">
              Already have a transcript? Upload a <code>.json</code> file. We
              accept ElevenLabs Scribe v1 output directly — so a collaborator
              can hand off their Scribe JSON, or you can convert another
              tool&apos;s output into the same shape (see below for the expected
              JSON format).
            </p>
          </div>

          {/* Format spec */}
          <div className="space-y-2">
            <div className="font-medium">JSON format</div>
            <p className="text-muted-foreground">
              The only requirement is a top-level <code>words</code> array.
              Each entry:
            </p>
            <ul className="ml-4 list-disc space-y-1 text-muted-foreground">
              <li>
                <code>text</code> — the token (a word or a space)
              </li>
              <li>
                <code>start</code>, <code>end</code> — timestamps in seconds
              </li>
              <li>
                <code>type</code> — <code>&quot;word&quot;</code> or{" "}
                <code>&quot;spacing&quot;</code>
              </li>
              <li>
                <code>speaker_id</code> — e.g. <code>&quot;speaker_0&quot;</code>,{" "}
                <code>&quot;speaker_1&quot;</code>
              </li>
            </ul>
            <p className="text-muted-foreground">
              <code>language_code</code>, <code>language_probability</code>, a
              top-level <code>text</code> string, and per-word{" "}
              <code>characters</code> are optional.
            </p>
            <pre className="overflow-x-auto rounded-md bg-muted p-3 text-xs leading-relaxed">
              {`{
  "words": [
    {
      "text": "So",
      "start": 0.14,
      "end": 0.219,
      "type": "word",
      "speaker_id": "speaker_0"
    }
  ]
}`}
            </pre>
          </div>

          <div>
            <Button render={<a href="/scribe-v1-example.json" download />}>
              Download example JSON
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
