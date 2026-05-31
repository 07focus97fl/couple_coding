"use client";

import { memo, type ReactNode } from "react";
import { CodedUnit, OutputType, RatingScale } from "@/lib/types";
import { codeFor, colorWithAlpha, FALLBACK_COLOR } from "@/lib/category-colors";
import s from "./RunRow.module.css";

function speakerKey(speaker: string): "a" | "b" {
  return /0|a/i.test(speaker) ? "a" : "b";
}

function dotColor(speaker: string): string {
  return speakerKey(speaker) === "a" ? "#7a8a99" : "var(--accent)";
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
}

function RunRowImpl({
  unit,
  index,
  color,
  outputType,
  scale,
  colorMap,
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
            style={{ background: dotColor(sp) }}
          />
        ))}
      </span>
    </div>
  ) : (
    <div className={s.speaker} data-speaker={speakerKey(unit.speaker ?? "")}>
      <span className={s.speakerDot} />
      <span className={s.speakerNum}>{unit.turnNumber}</span>
    </div>
  );

  // The code column is an error chip, a category chip, or per-dimension bars.
  let codeCol: ReactNode;
  if (unit.error) {
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

  const col2 = isTime ? "72px" : "44px";
  const col4 = isContinuous ? "168px" : "56px";

  return (
    <div
      className={s.row}
      style={{ gridTemplateColumns: `32px ${col2} 1fr ${col4}` }}
    >
      <div className={s.idx}>{index + 1}</div>
      {identity}
      <div className={s.text}>
        <div className={`${s.utter} ${isTime ? s.utterMulti : ""}`}>
          {unit.text}
        </div>
        <div className={s.rationale}>{unit.rationale}</div>
      </div>
      {codeCol}
    </div>
  );
}

export const RunRow = memo(RunRowImpl);
