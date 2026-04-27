"use client";

import { useRef } from "react";
import { useSession } from "../../hooks/CodingSessionContext";
import { SectionShell } from "../layout/SectionShell";
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

function audioStatusLabel(
  status: "pending" | "transcribing" | "done" | "error",
  error?: string,
): string {
  if (status === "pending") return "READY";
  if (status === "transcribing") return "TRANSCRIBING";
  if (status === "done") return "TRANSCRIBED";
  return error || "FAILED";
}

export function SectionUpload() {
  const {
    uploadMode,
    setUploadMode,
    files,
    audioFiles,
    dragOver,
    setDragOver,
    uploadError,
    processFiles,
    processAudioInput,
    removeFile,
    removeAudioFile,
    toggleFile,
    totalTurns,
    hasFiles,
    elevenLabsKey,
    setElevenLabsKey,
    showElevenKey,
    setShowElevenKey,
    devSignedIn,
    transcribeAllPending,
    isAnyTranscribing,
    pendingAudioCount,
  } = useSession();

  const transcriptInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);

  const transcriptActive = uploadMode === "transcript";
  const audioActive = uploadMode === "audio";

  const selectedFiles = files.filter((f) => f.selected);
  const summaryCount = transcriptActive ? selectedFiles.length : audioFiles.length;
  const summary = hasFiles
    ? `${summaryCount} · ${totalTurns} turns`
    : audioActive && audioFiles.length > 0
    ? `${audioFiles.length} audio`
    : "0 files";

  const onTranscriptDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length > 0) processFiles(e.dataTransfer.files);
  };

  const onAudioDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length > 0) processAudioInput(e.dataTransfer.files);
  };

  return (
    <SectionShell
      id="s-upload"
      number="01"
      label="Upload"
      title="Start with your recordings."
      description="Drop in word-level transcripts, or hand us raw audio and we'll transcribe with speaker diarization first. Couple-coding needs speaker-attributed turns — anything else we'll reject with a clear error."
      cardTitle="Upload"
      cardMeta={summary}
      state={hasFiles ? "done" : "idle"}
    >
      <div className={s.grid}>
        <div className={s.formatStack}>
          <button
            type="button"
            onClick={() => setUploadMode("transcript")}
            className={`${s.formatCard} ${transcriptActive ? s.formatCardActive : ""}`}
          >
            <div className={s.formatIcon}>
              <FileIcon />
            </div>
            <div>
              <div className={s.formatName}>Transcripts</div>
              <div className={s.formatDesc}>
                Word-level JSON · ElevenLabs, AssemblyAI
              </div>
            </div>
          </button>
          <button
            type="button"
            onClick={() => setUploadMode("audio")}
            className={`${s.formatCard} ${audioActive ? s.formatCardActive : ""}`}
          >
            <div className={s.formatIcon}>
              <MicIcon />
            </div>
            <div>
              <div className={s.formatName}>Audio / video</div>
              <div className={s.formatDesc}>
                MP3, MP4 · +$0.30/min transcription
              </div>
            </div>
          </button>
        </div>

        <div className={s.rightPane}>
          {transcriptActive ? (
            <>
              <div
                className={`${s.dropzone} ${dragOver ? s.dropzoneActive : ""}`}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={onTranscriptDrop}
                onClick={() => transcriptInputRef.current?.click()}
              >
                <input
                  ref={transcriptInputRef}
                  type="file"
                  accept=".json"
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
                    Drop to add more, or click to browse
                  </div>
                  <div className={s.dropSub}>
                    JSON · VTT with speaker tags
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
                    <div className={s.thStatus} />
                    <div className={s.thRemove} />
                  </div>
                  {files.map((f) => {
                    const duration = fileDurationSec(f.rawTranscript?.words);
                    const status =
                      f.status === "coding"
                        ? "coding"
                        : f.status === "done"
                        ? "done"
                        : f.status === "error"
                        ? "error"
                        : f.selected
                        ? "ready"
                        : "off";
                    return (
                      <div key={f.id} className={s.tr}>
                        <div className={s.tdCheck}>
                          <input
                            type="checkbox"
                            checked={f.selected}
                            onChange={() => toggleFile(f.id)}
                            className={s.checkbox}
                          />
                        </div>
                        <div className={s.tdFile}>
                          <span className={s.fileIcon}>
                            <FileIcon />
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
                        <div className={s.tdStatus}>
                          <span
                            className={`${s.statusDot} ${s[`statusDot_${status}`] ?? ""}`}
                          />
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
                    );
                  })}
                </div>
              )}
            </>
          ) : (
            <>
              <div
                className={`${s.dropzone} ${dragOver ? s.dropzoneActive : ""}`}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={onAudioDrop}
                onClick={() => audioInputRef.current?.click()}
              >
                <input
                  ref={audioInputRef}
                  type="file"
                  accept=".mp3,.mp4,.wav"
                  multiple
                  style={{ display: "none" }}
                  onChange={(e) => {
                    if (e.target.files && e.target.files.length > 0) {
                      processAudioInput(e.target.files);
                    }
                    e.target.value = "";
                  }}
                />
                <div className={s.dropIcon}>
                  <MicIcon />
                </div>
                <div>
                  <div className={s.dropTitle}>Drop audio files here</div>
                  <div className={s.dropSub}>MP3, MP4, or WAV</div>
                </div>
              </div>

              {uploadError && <div className={s.error}>{uploadError}</div>}

              {audioFiles.length > 0 && (
                <div className={s.audioList}>
                  {audioFiles.map((entry) => {
                    const statusKey = `statusDot_${
                      entry.status === "pending"
                        ? "ready"
                        : entry.status === "transcribing"
                        ? "coding"
                        : entry.status
                    }` as const;
                    const dotClass = s[statusKey] ?? "";
                    return (
                      <div key={entry.id} className={s.audioItem}>
                        <span className={s.fileIcon}>
                          <MicIcon />
                        </span>
                        <span className={s.fileName}>{entry.file.name}</span>
                        <span
                          className={`${s.audioStatus} ${
                            entry.status === "error" ? s.audioStatus_error : ""
                          }`}
                        >
                          <span className={`${s.statusDot} ${dotClass}`} />
                          {audioStatusLabel(entry.status, entry.error)}
                        </span>
                        <button
                          type="button"
                          onClick={() => removeAudioFile(entry.id)}
                          className={s.removeBtn}
                          aria-label="Remove"
                        >
                          <XIcon />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              {audioFiles.length > 0 && (
                <>
                  <div className={s.keyBlock}>
                    <div className={s.keyLabelRow}>
                      <span className={s.keyLabel}>ELEVENLABS API KEY</span>
                      <span
                        className={`${s.keyStatus} ${
                          devSignedIn || elevenLabsKey ? s.keyStatus_ok : ""
                        }`}
                      >
                        {devSignedIn
                          ? "Dev signed-in · using server key"
                          : elevenLabsKey
                          ? "Stored locally · only sent to ElevenLabs during transcription"
                          : "Paste your key — stored in this browser only"}
                      </span>
                    </div>
                    <div className={s.keyRow}>
                      <input
                        type={showElevenKey ? "text" : "password"}
                        className={s.keyInput}
                        value={devSignedIn ? "" : elevenLabsKey}
                        onChange={(e) => setElevenLabsKey(e.target.value)}
                        placeholder={
                          devSignedIn ? "Signed in — server key in use" : "sk_…"
                        }
                        spellCheck={false}
                        autoComplete="off"
                        disabled={devSignedIn}
                      />
                      <button
                        type="button"
                        onClick={() => setShowElevenKey(!showElevenKey)}
                        className={s.keyToggle}
                        aria-label={showElevenKey ? "Hide key" : "Show key"}
                        disabled={devSignedIn}
                      >
                        <EyeIcon open={showElevenKey} />
                      </button>
                    </div>
                  </div>
                  <div className={s.transcribeRow}>
                    <button
                      type="button"
                      className={s.transcribeBtn}
                      disabled={
                        (!elevenLabsKey && !devSignedIn) ||
                        pendingAudioCount === 0 ||
                        isAnyTranscribing
                      }
                      onClick={() => transcribeAllPending()}
                    >
                      {isAnyTranscribing
                        ? "Transcribing…"
                        : pendingAudioCount > 0
                        ? `Transcribe ${pendingAudioCount} file${
                            pendingAudioCount === 1 ? "" : "s"
                          }`
                        : "Transcribe"}
                    </button>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </SectionShell>
  );
}
