"use client";

import { useMemo, useState } from "react";
import {
  CategoryDefinition,
  Granularity,
  PROMPT_BLOCK_LABELS,
  PROMPT_BLOCK_ORDER,
  PromptBlocks,
  TranscriptFile,
} from "@/lib/types";
import { buildPreviewSample } from "@/lib/preview-sample";
import { buildSystemPrompt, buildUserMessage } from "@/app/api/code/prompts";
import s from "./prompt-preview.module.css";

type Tab = "system" | "user" | "tool";

interface PromptPreviewProps {
  granularity: Granularity;
  blocks: PromptBlocks;
  categories: CategoryDefinition[];
  contextWindow: number;
  files: TranscriptFile[];
  rawSystemOverride: string | null;
  onCommitRawOverride: (raw: string) => void;
  onRevertRawOverride: () => void;
}

function buildToolSchema(
  granularity: Granularity,
  categories: CategoryDefinition[]
): object {
  const enumValues = categories
    .filter((c) => c.name.trim() !== "")
    .map((c) => c.name);

  if (granularity === "turn") {
    return {
      name: "code_exchange",
      description: "Categorize a speaking turn and provide a rationale.",
      input_schema: {
        type: "object",
        properties: {
          category: { type: "string", enum: enumValues },
          rationale: { type: "string" },
        },
        required: ["category", "rationale"],
      },
    };
  }

  return {
    name: "code_exchange",
    description:
      "Segment a speaking turn into one or more coded utterances. Each utterance must quote a verbatim contiguous substring of the target turn.",
    input_schema: {
      type: "object",
      properties: {
        utterances: {
          type: "array",
          minItems: 1,
          items: {
            type: "object",
            properties: {
              text: {
                type: "string",
                description: "Verbatim contiguous substring of the target turn.",
              },
              category: { type: "string", enum: enumValues },
              rationale: { type: "string" },
            },
            required: ["text", "category", "rationale"],
          },
        },
      },
      required: ["utterances"],
    },
  };
}

export function PromptPreview({
  granularity,
  blocks,
  categories,
  contextWindow,
  files,
  rawSystemOverride,
  onCommitRawOverride,
  onRevertRawOverride,
}: PromptPreviewProps) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("system");
  const [editingRaw, setEditingRaw] = useState(false);
  const [rawDraft, setRawDraft] = useState("");

  const assembledSystem = useMemo(
    () => (rawSystemOverride !== null ? rawSystemOverride : buildSystemPrompt(blocks)),
    [blocks, rawSystemOverride]
  );

  const sample = useMemo(
    () => buildPreviewSample(files, contextWindow),
    [files, contextWindow]
  );
  const userMessage = useMemo(
    () => buildUserMessage(sample.contextTurns, sample.targetTurn),
    [sample]
  );
  const tool = useMemo(
    () => buildToolSchema(granularity, categories),
    [granularity, categories]
  );

  const startEditRaw = () => {
    setRawDraft(assembledSystem);
    setEditingRaw(true);
  };

  const commitRaw = () => {
    onCommitRawOverride(rawDraft);
    setEditingRaw(false);
  };

  const cancelRaw = () => {
    setEditingRaw(false);
  };

  return (
    <div className={s.previewWrap}>
      <div
        className={`${s.previewHeader} ${open ? "" : s.previewHeaderNoBorder}`}
        onClick={() => setOpen((v) => !v)}
      >
        <div className={s.previewHeaderLeft}>
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={`${s.previewChevron} ${open ? s.previewChevronOpen : ""}`}
          >
            <polyline points="9 18 15 12 9 6" />
          </svg>
          <div>
            <div className={s.previewTitle}>Full prompt preview</div>
            <div className={s.previewSub}>See exactly what&apos;s sent to Claude per turn</div>
          </div>
        </div>
        {rawSystemOverride !== null && (
          <span
            style={{
              fontFamily: "var(--mono)",
              fontSize: "0.62rem",
              fontWeight: 500,
              background: "#c45d3e18",
              color: "#c45d3e",
              padding: "0.15rem 0.5rem",
              borderRadius: 100,
              letterSpacing: "0.05em",
            }}
          >
            RAW OVERRIDE
          </span>
        )}
      </div>

      {open && (
        <div className={s.previewBody}>
          <div className={s.tabs}>
            <button
              type="button"
              className={`${s.tab} ${tab === "system" ? s.tabActive : ""}`}
              onClick={() => setTab("system")}
            >
              System
            </button>
            <button
              type="button"
              className={`${s.tab} ${tab === "user" ? s.tabActive : ""}`}
              onClick={() => setTab("user")}
            >
              User message
            </button>
            <button
              type="button"
              className={`${s.tab} ${tab === "tool" ? s.tabActive : ""}`}
              onClick={() => setTab("tool")}
            >
              Tool
            </button>

            <button
              type="button"
              className={s.copyBtn}
              onClick={() =>
                navigator.clipboard.writeText(
                  tab === "system"
                    ? assembledSystem
                    : tab === "user"
                    ? userMessage
                    : JSON.stringify(tool, null, 2)
                )
              }
              style={{ marginLeft: "auto" }}
              title="Copy to clipboard"
            >
              Copy
            </button>
            {tab === "system" && !editingRaw && (
              <button
                type="button"
                className={`${s.editRawBtn} ${
                  rawSystemOverride !== null ? s.editRawActive : ""
                }`}
                onClick={startEditRaw}
              >
                {rawSystemOverride !== null ? "Edit raw prompt" : "Edit raw"}
              </button>
            )}
          </div>

          {tab === "system" && editingRaw ? (
            <>
              <textarea
                className={s.rawTextarea}
                value={rawDraft}
                onChange={(e) => setRawDraft(e.target.value)}
                spellCheck={false}
              />
              <div className={s.rawActions}>
                <button
                  type="button"
                  className={s.rawActionBtn}
                  onClick={cancelRaw}
                >
                  Cancel
                </button>
                {rawSystemOverride !== null && (
                  <button
                    type="button"
                    className={s.rawActionBtn}
                    onClick={() => {
                      onRevertRawOverride();
                      setEditingRaw(false);
                    }}
                  >
                    Revert to blocks
                  </button>
                )}
                <button
                  type="button"
                  className={`${s.rawActionBtn} ${s.rawActionBtnPrimary}`}
                  onClick={commitRaw}
                >
                  Commit override
                </button>
              </div>
            </>
          ) : tab === "system" ? (
            rawSystemOverride !== null ? (
              <pre className={s.pre}>{assembledSystem}</pre>
            ) : (
              <pre className={s.pre}>
                {PROMPT_BLOCK_ORDER.map((key, idx) => {
                  const text = blocks[key]?.trim() ?? "";
                  if (!text) return null;
                  return (
                    <div key={key} className={s.block}>
                      {idx > 0 && <div className={s.blockDivider} />}
                      <span className={s.blockLabel}>{PROMPT_BLOCK_LABELS[key]}</span>
                      <div className={s.blockText}>{text}</div>
                    </div>
                  );
                })}
              </pre>
            )
          ) : tab === "user" ? (
            <pre className={s.pre}>{userMessage}</pre>
          ) : (
            <pre className={s.pre}>{JSON.stringify(tool, null, 2)}</pre>
          )}
        </div>
      )}
    </div>
  );
}
