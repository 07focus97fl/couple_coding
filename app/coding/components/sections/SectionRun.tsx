"use client";

import { useSession } from "../../hooks/CodingSessionContext";
import { useRunScope } from "../../hooks/useRunScope";
import { SectionShell } from "../layout/SectionShell";
import { ConversationCard } from "../run/ConversationCard";
import {
  formatCost,
  formatElapsed,
  formatEta,
  formatRate,
} from "../../hooks/useRunStats";
import s from "./SectionRun.module.css";

function PlayIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" stroke="none">
      <polygon points="7 5 19 12 7 19" />
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
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}

function LogsIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
    </svg>
  );
}

export function SectionRun() {
  const {
    isAnyCoding,
    anySelected,
    schemeId,
    selectedModel,
    stepDone,
    totalTurns,
    completedTurns,
    allCodedUnits,
    runStats,
    apiLogs,
    runCoding,
    handleExportAll,
    doneFiles,
    selectedFiles,
  } = useSession();

  const scope = useRunScope();

  const canRun =
    !isAnyCoding && anySelected && schemeId !== null && selectedModel !== "";

  const runState: "running" | "done" | "ready" | "blocked" = isAnyCoding
    ? "running"
    : stepDone[3]
    ? "done"
    : canRun
    ? "ready"
    : "blocked";

  const btnLabel =
    runState === "running" ? "Running…" : runState === "done" ? "Re-run" : "Run";

  const circleState =
    runState === "done" ? "done" : runState === "running" ? "active" : "idle";

  const pct = totalTurns > 0 ? (completedTurns / totalTurns) * 100 : 0;

  const hint = !anySelected
    ? "Select at least one file in Section 01"
    : !schemeId
    ? "Pick a scheme in Section 03"
    : !selectedModel
    ? "Pick a model in Section 02"
    : null;

  // Show the per-conversation cards once a run is underway or has produced output;
  // before that, the scope panel above already previews what the run will do.
  const hasActivity = isAnyCoding || allCodedUnits.length > 0;
  const multiFile = selectedFiles.length > 1;

  return (
    <SectionShell
      id="s-run"
      number="04"
      label="Run & Review"
      title="Watch it code, live."
      description="Every turn streams in with its category and the model's rationale. Click any row to inspect the full reasoning and override the code. Nothing is committed until you export — reliability is yours to verify."
      cardTitle="Run"
      cardMeta={totalTurns > 0 ? `${completedTurns}/${totalTurns}` : undefined}
      state={circleState}
      circleKind="accent"
      headAction={
        <div className={s.headActions}>
          {doneFiles.length > 0 && (
            <button
              type="button"
              onClick={handleExportAll}
              className={s.exportBtn}
              title="Download a combined CSV of every coded conversation"
            >
              <DownloadIcon />
              <span>Export CSV</span>
            </button>
          )}
          <button
            type="button"
            disabled={!canRun && !stepDone[3]}
            onClick={runCoding}
            className={`${s.runBtn} ${runState === "running" ? s.runBtnRunning : ""}`}
          >
            {runState !== "running" && <PlayIcon />}
            <span>{btnLabel}</span>
          </button>
        </div>
      }
    >
      {hint && !isAnyCoding && <div className={s.hint}>{hint}</div>}

      {!isAnyCoding && scope.apiCalls > 0 && (
        <div className={s.scopePanel}>
          <div className={s.scopeFact}>
            This run will make{" "}
            <strong>{scope.apiCalls.toLocaleString()}</strong> API call
            {scope.apiCalls !== 1 ? "s" : ""} — one per exchange — across{" "}
            {scope.fileCount} file{scope.fileCount !== 1 ? "s" : ""}.
          </div>
          {!runStats.hasUsage && (
            <div className={s.scopeGuide}>
              Cost can&rsquo;t be predicted reliably up front — it depends on
              transcript length, number of exchanges, context window, model, and
              how much the model writes per turn. To gauge it: code one
              transcript (or a small batch) first, read the exact{" "}
              <strong>per-exchange cost</strong> in the run summary below, then
              multiply by your total exchanges.
            </div>
          )}
          {scope.fileCount > 1 && (
            <details className={s.scopeFiles}>
              <summary>Per file</summary>
              {scope.perFile.map((f) => (
                <div key={f.fileName}>
                  {f.fileName}: {f.calls.toLocaleString()} call
                  {f.calls !== 1 ? "s" : ""}
                </div>
              ))}
            </details>
          )}
        </div>
      )}

      <div className={s.statsStrip}>
        <div className={s.statsLeft}>
          <span
            className={s.stateDot}
            data-state={
              runState === "running"
                ? "running"
                : runState === "done"
                ? "done"
                : "idle"
            }
          />
          <span className={s.statsText}>
            {totalTurns > 0 ? `${completedTurns}/${totalTurns}` : "—"}
          </span>
          <span className={s.statsDot}>·</span>
          <span className={s.statsDim}>
            {formatElapsed(runStats.elapsedMs)} elapsed
          </span>
          <span className={s.statsDot}>·</span>
          <span className={s.statsDim}>{formatEta(runStats.etaMs)} left</span>
          <span className={s.statsDot}>·</span>
          <span className={s.statsDim}>{formatRate(runStats.ratePerMin)}</span>
          <span className={s.statsDot}>·</span>
          <span className={s.statsDim}>
            {runStats.hasUsage ? formatCost(runStats.costUsd) : "—"}
          </span>
        </div>
        {apiLogs.length > 0 && (
          <button
            type="button"
            onClick={() => window.open("/logs", "_blank")}
            className={s.logsBtn}
          >
            <LogsIcon />
            API logs ({apiLogs.length})
          </button>
        )}
      </div>

      {!isAnyCoding && runStats.hasUsage && (
        <div className={s.costSummary}>
          <span className={s.costTotal}>{formatCost(runStats.costUsd)}</span>
          {multiFile && <span className={s.costScope}>across all conversations</span>}
          <span className={s.statsDot}>·</span>
          <span className={s.statsDim}>
            {runStats.inputTokens.toLocaleString()} in ·{" "}
            {runStats.outputTokens.toLocaleString()} out
            {runStats.cacheReadTokens > 0
              ? ` · ${runStats.cacheReadTokens.toLocaleString()} cached`
              : ""}
          </span>
          <span className={s.statsDot}>·</span>
          <span className={s.statsDim}>
            ≈{" "}
            {formatCost(
              apiLogs.length > 0 ? runStats.costUsd / apiLogs.length : 0,
            )}{" "}
            per exchange (over {apiLogs.length})
          </span>
        </div>
      )}

      <div className={s.progressBar}>
        <div className={s.progressFill} style={{ width: `${pct}%` }} />
      </div>

      {hasActivity ? (
        <div className={s.convList}>
          {selectedFiles.map((f) => (
            <ConversationCard key={f.id} file={f} defaultOpen={!multiFile} />
          ))}
        </div>
      ) : (
        <div className={s.emptyRows}>
          Coded rows will stream here as the run progresses.
        </div>
      )}
    </SectionShell>
  );
}
