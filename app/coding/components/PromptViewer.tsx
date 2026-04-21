"use client";

import { useState } from "react";
import s from "./prompt-preview.module.css";

type Tab = "system" | "user" | "tool";

interface PromptViewerProps {
  systemPrompt: string;
  userMessage: string;
  tool: object;
  defaultTab?: Tab;
  copyable?: boolean;
}

export function PromptViewer({
  systemPrompt,
  userMessage,
  tool,
  defaultTab = "system",
  copyable = true,
}: PromptViewerProps) {
  const [tab, setTab] = useState<Tab>(defaultTab);

  const current =
    tab === "system"
      ? systemPrompt
      : tab === "user"
      ? userMessage
      : JSON.stringify(tool, null, 2);

  return (
    <div>
      <div className={s.tabs}>
        <TabBtn active={tab === "system"} onClick={() => setTab("system")}>
          System
        </TabBtn>
        <TabBtn active={tab === "user"} onClick={() => setTab("user")}>
          User message
        </TabBtn>
        <TabBtn active={tab === "tool"} onClick={() => setTab("tool")}>
          Tool
        </TabBtn>
        {copyable && (
          <button
            type="button"
            className={s.copyBtn}
            onClick={() => navigator.clipboard.writeText(current)}
            title="Copy to clipboard"
          >
            Copy
          </button>
        )}
      </div>
      <pre className={s.pre}>{current}</pre>
    </div>
  );
}

function TabBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      className={`${s.tab} ${active ? s.tabActive : ""}`}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
