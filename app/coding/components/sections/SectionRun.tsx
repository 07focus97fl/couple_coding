"use client";

import { useMemo } from "react";
import { useSession } from "../../hooks/CodingSessionContext";
import { sortUnits } from "../../hooks/useCodingSession";
import { SectionShell } from "../layout/SectionShell";
import { CategoryHistogram } from "../run/CategoryHistogram";
import { RunRow } from "../run/RunRow";
import { ExportButton } from "../ExportButton";
import { FALLBACK_COLOR } from "@/lib/category-colors";
import {
  formatCost,
  formatElapsed,
  formatEta,
  formatRate,
} from "../../hooks/useRunStats";
import s from "./SectionRun.module.css";

function PlayIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="currentColor"
      stroke="none"
    >
      <polygon points="7 5 19 12 7 19" />
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

const MAX_VISIBLE_ROWS = 200;

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
    categoryColorMap,
    runStats,
    apiLogs,
    runCoding,
    doneFiles,
    files,
  } = useSession();

  const canRun =
    !isAnyCoding &&
    anySelected &&
    schemeId !== null &&
    selectedModel !== "";

  const runState: "running" | "done" | "ready" | "blocked" = isAnyCoding
    ? "running"
    : stepDone[3]
    ? "done"
    : canRun
    ? "ready"
    : "blocked";

  const btnLabel =
    runState === "running"
      ? "Running…"
      : runState === "done"
      ? "Re-run"
      : "Run";

  const circleState =
    runState === "done"
      ? "done"
      : runState === "running"
      ? "active"
      : "idle";

  const pct = totalTurns > 0 ? (completedTurns / totalTurns) * 100 : 0;

  const sortedUnits = useMemo(
    () => sortUnits(allCodedUnits),
    [allCodedUnits],
  );

  const visibleUnits = sortedUnits.slice(-MAX_VISIBLE_ROWS);
  const truncated = sortedUnits.length - visibleUnits.length;
  const baseIdx = sortedUnits.length - visibleUnits.length;

  const hint = !anySelected
    ? "Select at least one file in Section 01"
    : !schemeId
    ? "Pick a scheme in Section 03"
    : !selectedModel
    ? "Pick a model in Section 02"
    : null;

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
        <button
          type="button"
          disabled={!canRun && !stepDone[3]}
          onClick={runCoding}
          className={`${s.runBtn} ${runState === "running" ? s.runBtnRunning : ""}`}
        >
          {runState !== "running" && <PlayIcon />}
          <span>{btnLabel}</span>
        </button>
      }
    >
      {hint && !isAnyCoding && (
        <div className={s.hint}>{hint}</div>
      )}

      <div className={s.statsStrip}>
        <div className={s.statsLeft}>
          <span
            className={s.stateDot}
            data-state={runState === "running" ? "running" : runState === "done" ? "done" : "idle"}
          />
          <span className={s.statsText}>
            {totalTurns > 0 ? `${completedTurns}/${totalTurns}` : "—"}
          </span>
          <span className={s.statsDot}>·</span>
          <span className={s.statsDim}>
            {formatElapsed(runStats.elapsedMs)} elapsed
          </span>
          <span className={s.statsDot}>·</span>
          <span className={s.statsDim}>
            {formatEta(runStats.etaMs)} left
          </span>
          <span className={s.statsDot}>·</span>
          <span className={s.statsDim}>
            {formatRate(runStats.ratePerMin)}
          </span>
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

      <div className={s.progressBar}>
        <div className={s.progressFill} style={{ width: `${pct}%` }} />
      </div>

      <CategoryHistogram />

      {visibleUnits.length > 0 ? (
        <div className={s.rows}>
          {truncated > 0 && (
            <div className={s.truncNote}>
              Showing latest {visibleUnits.length} of {sortedUnits.length} coded
              units — export for the full list.
            </div>
          )}
          {visibleUnits.map((unit, i) => (
            <RunRow
              key={unit.unitId}
              unit={unit}
              index={baseIdx + i}
              color={categoryColorMap[unit.category ?? ""] ?? FALLBACK_COLOR}
            />
          ))}
        </div>
      ) : (
        <div className={s.emptyRows}>
          {isAnyCoding
            ? "Streaming results in…"
            : "Coded rows will stream here as the run progresses."}
        </div>
      )}

      {doneFiles.length > 0 && (
        <div className={s.exportRow}>
          {doneFiles.map((f) => {
            const sorted = sortUnits(f.codedUnits);
            return (
              <div key={f.id} className={s.exportItem}>
                <div className={s.exportName}>
                  {f.fileName}
                  <span className={s.exportCount}>
                    {sorted.length} unit{sorted.length !== 1 ? "s" : ""}
                  </span>
                </div>
                <ExportButton codedTurns={sorted} />
              </div>
            );
          })}
        </div>
      )}

      {files.some((f) => f.status === "error") && (
        <div className={s.errorStrip}>
          {files
            .filter((f) => f.status === "error")
            .map((f) => (
              <div key={f.id}>
                <strong>{f.fileName}:</strong> {f.error}
              </div>
            ))}
        </div>
      )}
    </SectionShell>
  );
}
