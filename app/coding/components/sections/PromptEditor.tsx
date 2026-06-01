"use client";

import { useMemo, useState } from "react";
import { useSession } from "../../hooks/CodingSessionContext";
import s from "./PromptEditor.module.css";

function ChevronSvg({ open }: { open: boolean }) {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={open ? s.chevronOpen : s.chevron}
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

export function PromptEditor() {
  const {
    systemPrompt,
    setSystemPrompt,
    promptDirty,
    resetPrompt,
    activeScheme,
    schemeId,
  } = useSession();

  const [open, setOpen] = useState(true);

  const wordCount = useMemo(() => {
    const trimmed = systemPrompt.trim();
    if (!trimmed) return 0;
    return trimmed.split(/\s+/).length;
  }, [systemPrompt]);

  const charCount = systemPrompt.length;

  const schemeReady = activeScheme !== null || schemeId === "custom";

  return (
    <div className={s.wrap}>
      <button
        type="button"
        className={s.header}
        onClick={() => setOpen((v) => !v)}
      >
        <ChevronSvg open={open} />
        <span className={s.label}>Prompt</span>
        <span className={s.metaDot}>·</span>
        <span className={s.meta}>
          {wordCount} word{wordCount === 1 ? "" : "s"}
        </span>
        {promptDirty && (
          <>
            <span className={s.metaDot}>·</span>
            <span className={s.editedTag}>edited</span>
          </>
        )}
        {promptDirty && schemeReady && (
          <div className={s.headerRight}>
            <button
              type="button"
              className={s.resetBtn}
              onClick={(e) => {
                e.stopPropagation();
                resetPrompt();
              }}
            >
              Reset
            </button>
          </div>
        )}
      </button>

      {open && (
        <div className={s.body}>
          {schemeReady ? (
            <>
              <textarea
                className={s.textarea}
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                spellCheck={false}
                placeholder="Your prompt appears here. Categories are appended automatically."
              />
              <div className={s.hint}>
                Categories defined above are appended to this prompt
                automatically — you don&apos;t need to list them here.
                <span className={s.hintDim}> {charCount.toLocaleString()} chars</span>
              </div>
            </>
          ) : (
            <div className={s.empty}>
              Pick a scheme first to see its default prompt.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
