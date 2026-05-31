"use client";

import { useRef } from "react";
import { useSession } from "../../hooks/CodingSessionContext";
import { SectionShell } from "../layout/SectionShell";
import { TranscriptFile } from "@/lib/types";
import s from "./SectionUpload.module.css";

function FileIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  );
}

function MicIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" />
      <path d="M19 10v2a7 7 0 01-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="23" />
      <line x1="8" y1="23" x2="16" y2="23" />
    </svg>
  );
}

function UploadIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}

function EyeIcon({ open }: { open: boolean }) {
  if (!open) {
    return (
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94" />
        <path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19" />
        <line x1="1" y1="1" x2="23" y2="23" />
      </svg>
    );
  }
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return "—";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function fileDurationSec(words: { end: number }[] | undefined): number {
  if (!words || words.length === 0) return 0;
  return words[words.length - 1].end;
}

type RowState =
  | "transcribe-pending"
  | "transcribe-running"
  | "transcribe-error"
  | "ready"
  | "coding"
  | "done"
  | "error"
  | "off";

function rowState(f: TranscriptFile): RowState {
  if (f.audioSource && f.transcribeStatus && f.transcribeStatus !== "done") {
    if (f.transcribeStatus === "transcribing") return "transcribe-running";
    if (f.transcribeStatus === "error") return "transcribe-error";
    return "transcribe-pending";
  }
  if (f.status === "coding") return "coding";
  if (f.status === "done") return "done";
  if (f.status === "error") return "error";
  return f.selected ? "ready" : "off";
}

function rowStatusLabel(state: RowState, f: TranscriptFile): string {
  switch (state) {
    case "transcribe-pending":
      return "To transcribe";
    case "transcribe-running":
      return "Transcribing…";
    case "transcribe-error":
      return f.transcribeError || "Transcribe failed";
    case "coding":
      return "Coding…";
    case "done":
      return "Coded";
    case "error":
      return f.error || "Error";
    case "ready":
      return "Ready";
    case "off":
      return "Ready";
  }
}

const STATE_TO_DOT_CLASS: Record<RowState, string> = {
  "transcribe-pending": "statusDot_off",
  "transcribe-running": "statusDot_coding",
  "transcribe-error": "statusDot_error",
  ready: "statusDot_ready",
  coding: "statusDot_coding",
  done: "statusDot_done",
  error: "statusDot_error",
  off: "statusDot_off",
};

export function SectionUpload() {
  const {
    files,
    dragOver,
    setDragOver,
    uploadError,
    processFiles,
    removeFile,
    toggleFile,
    transcribeAudio,
    transcribeAllPending,
    downloadRawTranscript,
    isAnyTranscribing,
    pendingAudioCount,
    totalTurns,
    hasFiles,
    elevenLabsKey,
    setElevenLabsKey,
    showElevenKey,
    setShowElevenKey,
  } = useSession();

  const inputRef = useRef<HTMLInputElement>(null);

  const selectedFiles = files.filter((f) => f.selected);
  const hasAudioRow = files.some((f) => f.audioSource);
  const summary = hasFiles
    ? `${selectedFiles.length} · ${totalTurns} turns`
    : "0 files";

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length > 0) processFiles(e.dataTransfer.files);
  };

  return (
    <SectionShell
      id="s-upload"
      number="01"
      label="Upload"
      title="Start with your recordings."
      description="Drop in word-level transcripts or raw audio. Audio rows can be transcribed with ElevenLabs (with speaker diarization), then coded alongside any transcripts you uploaded directly."
      cardTitle="Upload"
      cardMeta={summary}
      state={hasFiles ? "done" : "idle"}
    >
      <div className={s.stack}>
        <div
          className={`${s.dropzone} ${dragOver ? s.dropzoneActive : ""}`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          onClick={() => inputRef.current?.click()}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".json,.mp3,.mp4,.wav"
            multiple
            style={{ display: "none" }}
            onChange={(e) => {
              if (e.target.files && e.target.files.length > 0) {
                processFiles(e.target.files);
              }
              e.target.value = "";
            }}
          />
          <div className={s.dropIcon}>
            <UploadIcon />
          </div>
          <div>
            <div className={s.dropTitle}>
              Drop transcripts or audio
            </div>
            <div className={s.dropSub}>
              JSON · MP3 · MP4 · WAV
            </div>
          </div>
        </div>

        {uploadError && <div className={s.error}>{uploadError}</div>}

        {files.length > 0 && (
          <div className={s.table}>
            <div className={s.tableHead}>
              <div className={s.thCheck} />
              <div className={s.thFile}>FILE</div>
              <div className={s.thTurns}>TURNS</div>
              <div className={s.thDuration}>DURATION</div>
              <div className={s.thStatus}>STATUS</div>
              <div className={s.thAction} />
              <div className={s.thRemove} />
            </div>
            {files.map((f) => {
              const state = rowState(f);
              const isAudio = f.audioSource !== undefined;
              const checkboxDisabled = isAudio && !f.rawTranscript;
              const duration = fileDurationSec(f.rawTranscript?.words);
              const showTranscribe =
                isAudio &&
                (f.transcribeStatus === "pending" ||
                  f.transcribeStatus === "error");
              const showDownload = isAudio && f.rawTranscript !== null;
              const dotClass = s[STATE_TO_DOT_CLASS[state]] ?? "";
              const statusLabel = rowStatusLabel(state, f);

              return (
                <div key={f.id} className={s.fileGroup}>
                  <div className={s.tr}>
                    <div className={s.tdCheck}>
                      <input
                        type="checkbox"
                        checked={f.selected}
                        disabled={checkboxDisabled}
                        onChange={() => toggleFile(f.id)}
                        className={s.checkbox}
                      />
                    </div>
                    <div className={s.tdFile}>
                      <span className={s.fileIcon}>
                        {isAudio ? <MicIcon /> : <FileIcon />}
                      </span>
                      <span
                        className={`${s.fileName} ${!f.selected ? s.fileNameOff : ""}`}
                      >
                        {f.fileName}
                      </span>
                    </div>
                    <div className={s.tdTurns}>{f.turns.length || "—"}</div>
                    <div className={s.tdDuration}>
                      {formatDuration(duration)}
                    </div>
                    <div
                      className={s.tdStatus}
                      data-state={state}
                      title={statusLabel}
                    >
                      <span className={`${s.statusDot} ${dotClass}`} />
                      <span className={s.statusLabel}>{statusLabel}</span>
                    </div>
                    <div className={s.tdAction}>
                      {showTranscribe && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            transcribeAudio(f.id);
                          }}
                          disabled={
                            !elevenLabsKey || isAnyTranscribing
                          }
                          className={s.transcribeRowBtn}
                        >
                          Transcribe
                        </button>
                      )}
                      {showDownload && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            downloadRawTranscript(f.id);
                          }}
                          className={s.downloadBtn}
                          aria-label="Download transcript JSON"
                          title="Download transcript JSON"
                        >
                          <DownloadIcon />
                        </button>
                      )}
                    </div>
                    <div className={s.tdRemove}>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeFile(f.id);
                        }}
                        className={s.removeBtn}
                        aria-label="Remove"
                      >
                        <XIcon />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {hasAudioRow && (
          <div className={s.keyBlock}>
            <div className={s.keyLabelRow}>
              <span className={s.keyLabel}>ELEVENLABS API KEY</span>
              <span
                className={`${s.keyStatus} ${
                  elevenLabsKey ? s.keyStatus_ok : ""
                }`}
              >
                {elevenLabsKey
                  ? "Stored locally · only sent to ElevenLabs during transcription"
                  : "Paste your key — stored in this browser only"}
              </span>
            </div>
            <div className={s.keyRow}>
              <input
                type={showElevenKey ? "text" : "password"}
                className={s.keyInput}
                value={elevenLabsKey}
                onChange={(e) => setElevenLabsKey(e.target.value)}
                placeholder="sk_…"
                spellCheck={false}
                autoComplete="off"
              />
              <button
                type="button"
                onClick={() => setShowElevenKey(!showElevenKey)}
                className={s.keyToggle}
                aria-label={showElevenKey ? "Hide key" : "Show key"}
              >
                <EyeIcon open={showElevenKey} />
              </button>
            </div>
          </div>
        )}

        {pendingAudioCount > 0 && (
          <div className={s.transcribeRow}>
            <button
              type="button"
              className={s.transcribeBtn}
              disabled={
                !elevenLabsKey || isAnyTranscribing
              }
              onClick={() => transcribeAllPending()}
            >
              {isAnyTranscribing
                ? "Transcribing…"
                : `Transcribe ${pendingAudioCount} file${
                    pendingAudioCount === 1 ? "" : "s"
                  }`}
            </button>
          </div>
        )}
      </div>
    </SectionShell>
  );
}
