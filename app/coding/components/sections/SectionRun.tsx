"use client";
/**
 * WHAT:    Step 04: the Run / Stop and Export buttons, the pre-run call-count
 *          panel, live stats and cost, the human-vs-model agreement table for
 *          CSV-origin conversations, and one ConversationCard per selected file.
 * STEP:    Run. State comes from useSession() (useCodingRun) and useRunScope.
 * RUNS ON: client
 */

import { useMemo, useState } from "react";
import { useSession } from "../../hooks/CodingSessionContext";
import { useRunScope } from "../../hooks/useRunScope";
import { SectionShell } from "../layout/SectionShell";
import { ConversationCard } from "../run/ConversationCard";
import { AuditExportDialog } from "../run/AuditExportDialog";
import { ConfusionMatrix } from "../run/ConfusionMatrix";
import {
  formatCost,
  formatElapsed,
  formatEta,
  formatRate,
} from "../../hooks/useRunStats";
import { computeAgreement, mergeAgreements, type Agreement } from "@/lib/results/agreement";
import { isCsvOrigin } from "@/lib/transcript/file-origin";
import s from "./SectionRun.module.css";

function PlayIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" stroke="none">
      <polygon points="7 5 19 12 7 19" />
    </svg>
  );
}

function StopIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" stroke="none">
      <rect x="5" y="5" width="14" height="14" rx="2" />
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
    totalUnits,
    completedUnits,
    allCodedUnits,
    runStats,
    apiLogs,
    runCoding,
    stopRun,
    canStop,
    handleExportAll,
    hasAuditExport,
    runConfig,
    categories,
    doneFiles,
    selectedFiles,
    batchSize,
  } = useSession();

  const scope = useRunScope();
  const [auditOpen, setAuditOpen] = useState(false);

  // Human-vs-model agreement across every selected CSV-origin conversation.
  const agreement: Agreement | null = useMemo(() => {
    const parts: Agreement[] = [];
    for (const f of selectedFiles) {
      if (!isCsvOrigin(f) || f.codedUnits.length === 0) continue;
      const a = computeAgreement(f.source, f.codedUnits);
      if (a) parts.push(a);
    }
    return parts.length > 0 ? mergeAgreements(parts) : null;
  }, [selectedFiles]);

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

  const pct = totalUnits > 0 ? (completedUnits / totalUnits) * 100 : 0;

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
      description="Every turn streams in with its category and the model's rationale. Conversations uploaded as a coded CSV also show the human code beside the model's, with agreement totals below. Nothing is committed until you export — reliability is yours to verify."
      cardTitle="Run"
      cardMeta={totalUnits > 0 ? `${completedUnits}/${totalUnits}` : undefined}
      state={circleState}
      circleKind="accent"
      headAction={
        <div className={s.headActions}>
          {hasAuditExport && (
            <button
              type="button"
              onClick={() => setAuditOpen(true)}
              className={s.exportBtn}
              title="Download your uploaded CSV with the model's results and the run's configuration appended"
            >
              <DownloadIcon />
              <span>Export audit CSV</span>
            </button>
          )}
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
          {canStop && (
            <button
              type="button"
              onClick={stopRun}
              className={s.stopBtn}
              title="Stop after the calls already in flight; later conversations are not started"
            >
              <StopIcon />
              <span>Stop</span>
            </button>
          )}
          <button
            type="button"
            disabled={(!canRun && !stepDone[3]) || canStop}
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

      {!isAnyCoding && (scope.apiCalls > 0 || scope.blocked.length > 0) && (
        <div className={s.scopePanel}>
          {scope.apiCalls > 0 && (
            <div className={s.scopeFact}>
              This run will make{" "}
              <strong>{scope.apiCalls.toLocaleString()}</strong> API call
              {scope.apiCalls !== 1 ? "s" : ""} —{" "}
              {batchSize > 1
                ? `up to ${batchSize} units per call`
                : "one per unit"}{" "}
              — across {scope.fileCount} file
              {scope.fileCount !== 1 ? "s" : ""}.
            </div>
          )}
          {scope.blocked.length > 0 && (
            <div className={s.scopeBlocked}>
              {scope.blocked.length === 1
                ? `${scope.blocked[0].fileName} will be skipped: ${scope.blocked[0].reason}`
                : `${scope.blocked.length} files will be skipped: ${scope.blocked[0].reason}`}
            </div>
          )}
          {!runStats.hasUsage && scope.apiCalls > 0 && (
            <div className={s.scopeGuide}>
              Cost can&rsquo;t be predicted reliably up front — it depends on
              transcript length, number of units, context window, model, and
              how much the model writes per turn. To gauge it: code one
              transcript (or a small batch) first, read the exact{" "}
              <strong>per-unit cost</strong> in the run summary below, then
              multiply by your total units.
            </div>
          )}
          {scope.fileCount > 1 && (
            <details className={s.scopeFiles}>
              <summary>Per file</summary>
              {scope.perFile.map((f) => (
                <div key={f.id}>
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
            {totalUnits > 0 ? `${completedUnits}/${totalUnits}` : "—"}
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
              runStats.completed > 0
                ? runStats.costUsd / runStats.completed
                : 0,
            )}{" "}
            per unit (over {runStats.completed.toLocaleString()})
          </span>
        </div>
      )}

      <div className={s.progressBar}>
        <div className={s.progressFill} style={{ width: `${pct}%` }} />
      </div>

      {agreement && agreement.n > 0 && (
        <ConfusionMatrix
          agreement={agreement}
          categories={runConfig?.categories ?? categories}
        />
      )}

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

      <AuditExportDialog open={auditOpen} onOpenChange={setAuditOpen} />
    </SectionShell>
  );
}
