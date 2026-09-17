"use client";
/**
 * WHAT:    One coded unit: index, speaker, text, rationale and its category chip or
 *          rating bars; for a CSV-origin conversation, also the human code chip
 *          marked as a match or a mismatch. Memoized and fed by props so
 *          streaming rows stay cheap.
 * STEP:    Run.
 * RUNS ON: client
 */

import { memo, type ReactNode } from "react";
import { CodedUnit, OutputType, RatingScale } from "@/lib/types";
import { codeFor, colorWithAlpha, FALLBACK_COLOR } from "@/lib/results/category-colors";
import { agreeCell } from "@/lib/results/agreement";
import s from "./RunRow.module.css";

/**
 * Which of the two speaker colours a speaker gets: by position in the file's
 * roster when known, else by the historical speaker_0 / speaker_1 heuristic.
 */
function speakerKey(speaker: string, roster?: string[]): "a" | "b" {
  if (roster) {
    const i = roster.indexOf(speaker);
    if (i >= 0) return i % 2 === 0 ? "a" : "b";
  }
  return /0|a/i.test(speaker) ? "a" : "b";
}

function dotColor(speaker: string, roster?: string[]): string {
  return speakerKey(speaker, roster) === "a" ? "#7a8a99" : "var(--accent)";
}

function fmtTime(t: number): string {
  const m = Math.floor(t / 60);
  const sec = Math.floor(t % 60);
  return `${m}:${String(sec).padStart(2, "0")}`;
}

interface RunRowProps {
  unit: CodedUnit;
  index: number;
  color: string;
  outputType: OutputType;
  scale: RatingScale;
  colorMap: Record<string, string>;
  /** Speakers of this file in order of first appearance (for colouring). */
  roster?: string[];
  /** The human code for this turn ("" when blank); undefined for non-CSV files. */
  humanCode?: string;
}

function RunRowImpl({
  unit,
  index,
  color,
  outputType,
  scale,
  colorMap,
  roster,
  humanCode,
}: RunRowProps) {
  const isTime = unit.kind === "time";
  const isContinuous = outputType === "continuous";
  const c = color || FALLBACK_COLOR;

  // The identity column adapts to time windows (which span multiple speakers).
  const identity: ReactNode = isTime ? (
    <div className={s.window}>
      <span className={s.windowId}>{unit.unitId}</span>
      <span className={s.windowRange}>
        {fmtTime(unit.startTime)}–{fmtTime(unit.endTime)}
      </span>
      <span className={s.windowDots}>
        {(unit.speakers ?? []).map((sp, i) => (
          <span
            key={i}
            className={s.speakerDot}
            style={{ background: dotColor(sp, roster) }}
          />
        ))}
      </span>
    </div>
  ) : (
    <div className={s.speaker} data-speaker={speakerKey(unit.speaker ?? "", roster)}>
      <span className={s.speakerDot} />
      <span className={s.speakerNum}>{unit.turnNumber}</span>
    </div>
  );

  // The code column is an error chip, a category chip, or per-dimension bars.
  let codeCol: ReactNode;
  if (unit.notApplicable) {
    codeCol = (
      <div
        className={s.chip}
        style={{ background: "#8a8a8a1f", color: "#8a8a8a" }}
        title="Did not speak in this window"
      >
        N/A
      </div>
    );
  } else if (unit.error) {
    codeCol = (
      <div
        className={s.chip}
        style={{ background: "#c4452318", color: "#c44523" }}
        title={unit.rationale}
      >
        ERR
      </div>
    );
  } else if (isContinuous && unit.ratings) {
    const span = scale.max - scale.min || 1;
    codeCol = (
      <div className={s.ratings}>
        {Object.entries(unit.ratings).map(([dim, v]) => {
          const dc = colorMap[dim] ?? FALLBACK_COLOR;
          const pct = Math.max(0, Math.min(100, ((v - scale.min) / span) * 100));
          return (
            <div key={dim} className={s.ratingRow} title={`${dim}: ${v}`}>
              <span className={s.ratingLabel} style={{ color: dc }}>
                {codeFor(dim)}
              </span>
              <span className={s.ratingBar}>
                <span
                  className={s.ratingFill}
                  style={{ width: `${pct}%`, background: dc }}
                />
              </span>
              <span className={s.ratingVal}>{v}</span>
            </div>
          );
        })}
      </div>
    );
  } else {
    const chipText = unit.subcategory
      ? `${codeFor(unit.category ?? "")}/${unit.subcategory}`
      : codeFor(unit.category ?? "");
    const chipTitle = unit.subcategory
      ? `${unit.category} (${unit.subcategory})`
      : unit.category;
    codeCol = (
      <div
        className={s.chip}
        style={{ background: colorWithAlpha(c, 0.18), color: c }}
        title={chipTitle}
      >
        {chipText}
      </div>
    );
  }

  // The human code chip (CSV-origin files only): green on a match, red on a
  // mismatch, plain when the humans left the turn uncoded.
  const showHuman = humanCode !== undefined;
  const humanCol: ReactNode = showHuman ? (
    <div
      className={s.humanChip}
      data-match={agreeCell(humanCode, unit)}
      title={
        humanCode
          ? `Human code: ${humanCode}`
          : "No human code for this turn"
      }
    >
      {humanCode ? codeFor(humanCode) : "—"}
    </div>
  ) : null;

  const col2 = isTime ? "72px" : "44px";
  const col4 = isContinuous ? "168px" : "56px";
  const humanCol4 = showHuman ? "56px " : "";

  return (
    <div
      className={s.row}
      style={{ gridTemplateColumns: `32px ${col2} 1fr ${humanCol4}${col4}` }}
    >
      <div className={s.idx}>{index + 1}</div>
      {identity}
      <div className={s.text}>
        <div className={`${s.utter} ${isTime ? s.utterMulti : ""}`}>
          {unit.text || (unit.notApplicable ? "(no speech)" : "")}
        </div>
        <div className={s.rationale}>{unit.rationale}</div>
      </div>
      {humanCol}
      {codeCol}
    </div>
  );
}

export const RunRow = memo(RunRowImpl);
