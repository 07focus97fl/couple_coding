"use client";

import s from "./prompt-blocks.module.css";

interface OutputInstructionEditorProps {
  value: string;
  onChange: (v: string) => void;
}

export function OutputInstructionEditor({
  value,
  onChange,
}: OutputInstructionEditorProps) {
  return (
    <textarea
      className={s.textarea}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder="How the model should format its tool-use output."
      rows={3}
      spellCheck={false}
    />
  );
}
