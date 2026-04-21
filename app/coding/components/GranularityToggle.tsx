"use client";

import { Granularity } from "@/lib/types";
import s from "./prompt-blocks.module.css";

interface GranularityToggleProps {
  value: Granularity;
  onChange: (granularity: Granularity) => void;
}

const OPTIONS: { value: Granularity; name: string; desc: string }[] = [
  {
    value: "turn",
    name: "Speaking turn",
    desc: "One code per speaking turn. Traditional coding unit.",
  },
  {
    value: "utterance",
    name: "Utterance",
    desc: "The model segments each turn into behavioral units and codes each. Captures turns that contain multiple behavioral acts.",
  },
];

export function GranularityToggle({ value, onChange }: GranularityToggleProps) {
  return (
    <div className={s.granularityCards}>
      {OPTIONS.map((opt) => (
        <button
          key={opt.value}
          type="button"
          className={`${s.granularityCard} ${value === opt.value ? s.granularityCardSelected : ""}`}
          onClick={() => onChange(opt.value)}
        >
          <div className={s.granularityName}>{opt.name}</div>
          <div className={s.granularityDesc}>{opt.desc}</div>
        </button>
      ))}
    </div>
  );
}
