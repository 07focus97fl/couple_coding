"use client";

import { memo } from "react";
import { CodedUnit } from "@/lib/types";
import { codeFor, colorWithAlpha, FALLBACK_COLOR } from "@/lib/category-colors";
import s from "./RunRow.module.css";

function speakerKey(speaker: string): "a" | "b" {
  return /0|a/i.test(speaker) ? "a" : "b";
}

interface RunRowProps {
  unit: CodedUnit;
  index: number;
  color: string;
}

function RunRowImpl({ unit, index, color }: RunRowProps) {
  const sk = speakerKey(unit.speaker ?? "");
  const c = color || FALLBACK_COLOR;
  const chipText = unit.subcategory
    ? `${codeFor(unit.category ?? "")}/${unit.subcategory}`
    : codeFor(unit.category ?? "");
  const chipTitle = unit.subcategory
    ? `${unit.category} (${unit.subcategory})`
    : unit.category;
  return (
    <div className={s.row}>
      <div className={s.idx}>{index + 1}</div>
      <div className={s.speaker} data-speaker={sk}>
        <span className={s.speakerDot} />
        <span className={s.speakerNum}>{unit.turnNumber}</span>
      </div>
      <div className={s.text}>
        <div className={s.utter}>{unit.text}</div>
        <div className={s.rationale}>{unit.rationale}</div>
      </div>
      <div
        className={s.chip}
        style={{
          background: colorWithAlpha(c, 0.18),
          color: c,
        }}
        title={chipTitle}
      >
        {chipText}
      </div>
    </div>
  );
}

export const RunRow = memo(RunRowImpl);
