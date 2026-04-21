"use client";

import s from "./prompt-blocks.module.css";

interface RoleEditorProps {
  value: string;
  onChange: (v: string) => void;
}

export function RoleEditor({ value, onChange }: RoleEditorProps) {
  return (
    <input
      type="text"
      className={s.input}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder="e.g., You are an expert behavioral coder..."
    />
  );
}
