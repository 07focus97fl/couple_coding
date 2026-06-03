"use client";

import { useMemo } from "react";
import { useSession } from "../../hooks/CodingSessionContext";
import { sortUnits } from "../../hooks/useCodingSession";
import { formatCost, sumLogUsage } from "../../hooks/useRunStats";
import { CategoryHistogram } from "./CategoryHistogram";
import { RunRow } from "./RunRow";
import { ExportButton } from "../ExportButton";
import { FALLBACK_COLOR } from "@/lib/category-colors";
import type { TranscriptFile } from "@/lib/types";
import s from "./ConversationCard.module.css";

const MAX_VISIBLE_ROWS = 200;

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{
        transform: open ? "rotate(180deg)" : "none",
        transition: "transform 0.15s",
      }}
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

/**
 * One coded conversation (transcript file), shown as a collapsible card so a run
 * over many conversations reads as a compact list. The header always shows that
 * conversation's own status, progress, and cost; expanding reveals its category
 * histogram and coded rows. Per-conversation cost is summed from the API logs
 * stamped with this file's name.
 */
export function ConversationCard({
  file,
  defaultOpen,
}: {
  file: TranscriptFile;
  defaultOpen: boolean;
}) {
  const {
    apiLogs,
    outputType,
    scale,
    categoryColorMap,
    openResults,
    toggleResultsOpen,
  } = useSession();

  const totals = useMemo(
    () => sumLogUsage(apiLogs.filter((l) => l.fileName === file.fileName)),
    [apiLogs, file.fileName],
  );
  const sorted = useMemo(() => sortUnits(file.codedUnits), [file.codedUnits]);

  const visible = sorted.slice(-MAX_VISIBLE_ROWS);
  const truncated = sorted.length - visible.length;
  const baseIdx = sorted.length - visible.length;

  const isOpen = openResults[file.id] ?? defaultOpen;
  const { completed, total } = file.progress;
  const pct = total > 0 ? (completed / total) * 100 : 0;
  const dotState =
    file.status === "coding"
      ? "running"
      : file.status === "done"
      ? "done"
      : file.status === "error"
      ? "error"
      : "idle";

  const toggle = () => toggleResultsOpen(file.id);

  return (
    <div className={s.card}>
      <div className={s.head}>
        <button
          type="button"
          className={s.toggle}
          onClick={toggle}
          aria-expanded={isOpen}
        >
          <span className={s.dot} data-state={dotState} />
          <span className={s.name}>{file.fileName}</span>
          {file.topic ? <span className={s.topic}>{file.topic}</span> : null}
        </button>
        <div className={s.meta}>
          <span className={s.metaNum}>
            {completed}/{total}
          </span>
          <span className={s.sep}>·</span>
          <span className={s.metaDim}>
            {totals.hasUsage ? formatCost(totals.costUsd) : "—"}
          </span>
          {file.codedUnits.length > 0 && <ExportButton codedTurns={sorted} />}
          <button
            type="button"
            className={s.chevron}
            onClick={toggle}
            aria-label={isOpen ? "Collapse" : "Expand"}
          >
            <Chevron open={isOpen} />
          </button>
        </div>
      </div>

      <div className={s.progressBar}>
        <div className={s.progressFill} style={{ width: `${pct}%` }} />
      </div>

      {isOpen && (
        <div className={s.body}>
          {file.status === "error" && file.error ? (
            <div className={s.error}>
              <strong>Error:</strong> {file.error}
            </div>
          ) : null}

          {totals.hasUsage && (
            <div className={s.usageLine}>
              {totals.inputTokens.toLocaleString()} in ·{" "}
              {totals.outputTokens.toLocaleString()} out · ≈{" "}
              {formatCost(
                file.progress.completed > 0
                  ? totals.costUsd / file.progress.completed
                  : 0,
              )}{" "}
              per exchange (over {file.progress.completed.toLocaleString()})
            </div>
          )}

          {sorted.length > 0 ? (
            <>
              <CategoryHistogram units={file.codedUnits} />
              <div className={s.rows}>
                {truncated > 0 && (
                  <div className={s.truncNote}>
                    Showing latest {visible.length} of {sorted.length} coded
                    units — export for the full list.
                  </div>
                )}
                {visible.map((unit, i) => (
                  <RunRow
                    key={unit.unitId}
                    unit={unit}
                    index={baseIdx + i}
                    color={categoryColorMap[unit.category ?? ""] ?? FALLBACK_COLOR}
                    outputType={outputType}
                    scale={scale}
                    colorMap={categoryColorMap}
                  />
                ))}
              </div>
            </>
          ) : (
            <div className={s.emptyRows}>
              {file.status === "coding"
                ? "Streaming results in…"
                : "No coded rows yet."}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
