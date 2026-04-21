"use client";

import s from "./prompt-blocks.module.css";

interface ContextFramingEditorProps {
  value: string;
  onChange: (v: string) => void;
}

export function ContextFramingEditor({ value, onChange }: ContextFramingEditorProps) {
  return (
    <textarea
      className={s.textarea}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder="How the model should use the context turns you send alongside the target turn."
      rows={3}
      spellCheck={false}
    />
  );
}
