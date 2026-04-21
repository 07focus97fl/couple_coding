"use client";

import s from "./prompt-blocks.module.css";

interface RulesEditorProps {
  value: string;
  onChange: (v: string) => void;
  showAuthoredForTurnWarning?: boolean;
}

export function RulesEditor({
  value,
  onChange,
  showAuthoredForTurnWarning,
}: RulesEditorProps) {
  return (
    <>
      {showAuthoredForTurnWarning && (
        <div className={s.warningBanner}>
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={s.warningBannerIcon}
          >
            <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          <span>
            This scheme&apos;s rules were authored for turn-level coding. Review before running in utterance mode — the precedence hierarchy and context rules may reference &quot;turn&quot; terminology that no longer fits.
          </span>
        </div>
      )}
      <textarea
        className={`${s.textarea} ${s.textareaLarge}`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="e.g., precedence hierarchy, context rules, edge cases..."
        spellCheck={false}
      />
    </>
  );
}
