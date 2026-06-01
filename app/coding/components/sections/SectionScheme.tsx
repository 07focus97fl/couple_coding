"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useSession } from "../../hooks/CodingSessionContext";
import { SectionShell } from "../layout/SectionShell";
import { CODING_SCHEMES } from "@/lib/coding-schemes";
import { CategoryDefinition } from "@/lib/types";
import { codeFor, FALLBACK_COLOR } from "@/lib/category-colors";
import { PromptEditor } from "./PromptEditor";
import { TopicTable } from "./TopicTable";
import s from "./SectionScheme.module.css";

/**
 * Split a category definition into a human title (its leading sentence/name)
 * and the remaining preview text — e.g. "Non-Constructive. Process-focused…"
 * → { title: "Non-Constructive", rest: "Process-focused…" }.
 */
function splitDefinition(description: string): { title: string; rest: string } {
  const text = (description ?? "").trim();
  if (!text) return { title: "", rest: "" };
  const m = text.match(/^([^.!?]*[.!?])\s+([\s\S]*)$/);
  if (m && m[2].trim()) {
    return { title: m[1].replace(/[.!?]+\s*$/, "").trim(), rest: m[2].trim() };
  }
  return { title: text.replace(/[.!?]+\s*$/, "").trim(), rest: "" };
}

function XIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      className={open ? s.chevronOpen : s.chevron}
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

function CategoryRow({
  cat,
  color,
  onUpdate,
  onRemove,
}: {
  cat: CategoryDefinition;
  color: string;
  onUpdate: (next: CategoryDefinition) => void;
  onRemove: () => void;
}) {
  // Newly added (empty) categories start expanded so the code/definition
  // fields are immediately visible.
  const [open, setOpen] = useState(() => !cat.name && !cat.description);
  const descRef = useRef<HTMLTextAreaElement>(null);

  const { title, rest } = splitDefinition(cat.description);
  const displayTitle = title || cat.name || "Untitled";

  // Grow the textarea to fit its content so the full definition is visible
  // (capped by max-height in CSS, after which it scrolls).
  const autosize = useCallback(() => {
    const el = descRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight + el.offsetHeight - el.clientHeight}px`;
  }, []);

  useEffect(() => {
    if (open) autosize();
  }, [autosize, cat.description, open]);

  return (
    <div className={s.catRow}>
      <div className={s.catRowHead}>
        <button
          type="button"
          className={s.disclosure}
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
        >
          <span
            className={s.swatch}
            style={{ background: color || FALLBACK_COLOR }}
          >
            {codeFor(cat.name)}
          </span>
          <span className={s.rowText}>
            <span className={s.rowName}>{displayTitle}</span>
            {!open && rest && <span className={s.rowPreview}>{rest}</span>}
          </span>
          <ChevronIcon open={open} />
        </button>
        <button
          type="button"
          className={s.rowRemove}
          onClick={onRemove}
          aria-label="Remove category"
          title="Remove"
        >
          <XIcon />
        </button>
      </div>
      {open && (
        <div className={s.rowBody}>
          <label className={s.codeField}>
            <span className={s.codeFieldLabel}>
              Code
              <span className={s.codeFieldHint}>
                (i.e., what the AI will output)
              </span>
            </span>
            <input
              className={s.codeInput}
              value={cat.name}
              placeholder="e.g. DEN"
              spellCheck={false}
              onChange={(e) => onUpdate({ ...cat, name: e.target.value })}
            />
          </label>
          <textarea
            ref={descRef}
            className={s.rowDesc}
            value={cat.description}
            placeholder="Definition / distinguishing rules — what sets this code apart."
            rows={2}
            spellCheck={false}
            onChange={(e) => onUpdate({ ...cat, description: e.target.value })}
          />
        </div>
      )}
    </div>
  );
}

// Plain-language explanations surfaced via the (i) on each coding-type pill.
const SEGMENT_INFO: Record<string, string> = {
  turn: "One speaker turn — everything a person says before the other replies. The whole turn is coded as a single unit.",
  utterance:
    "Longer turns are split into individual utterances (complete thoughts), and each utterance is coded on its own.",
  time: "The conversation is divided into fixed-length time windows; each window — which may span both speakers — is coded as one unit.",
};

const OUTPUT_INFO: Record<string, string> = {
  categorical: "The model labels each unit with one of the categories you defined.",
  continuous:
    "The model scores each unit on a numeric rating scale instead of picking a single label.",
};

const PER_SPEAKER_INFO: Record<string, string> = {
  on: "Each speaker in a window gets their own code (the model still sees the whole window for context). A speaker who doesn't talk in a window is marked N/A.",
  off: "The whole window is coded as one unit combining both speakers.",
};

/** Small (i) marker that reveals an explanatory tooltip on hover/focus. */
function InfoDot({ tip }: { tip: string }) {
  return (
    <span
      className={s.infoDot}
      tabIndex={0}
      role="note"
      aria-label={tip}
      onClick={(e) => e.stopPropagation()}
    >
      i
      <span className={s.infoTip} role="tooltip">
        {tip}
      </span>
    </span>
  );
}

/**
 * One numbered step in the Section 3 flow — a number badge + a vertical
 * connector spine on the left, title/subtitle, then its body. `last` drops the
 * connector tail so the spine ends at the final step.
 */
function StepBlock({
  n,
  title,
  subtitle,
  last,
  children,
}: {
  n: number;
  title: string;
  subtitle?: string;
  last?: boolean;
  children: ReactNode;
}) {
  return (
    <section className={s.step}>
      <div className={s.stepAside}>
        <span className={s.stepNum}>{n}</span>
        {!last && <span className={s.stepSpine} aria-hidden />}
      </div>
      <div className={s.stepMain}>
        <header className={s.stepHead}>
          <h4 className={s.stepTitle}>{title}</h4>
          {subtitle && <p className={s.stepSub}>{subtitle}</p>}
        </header>
        <div className={s.stepBody}>{children}</div>
      </div>
    </section>
  );
}

export function SectionScheme() {
  const {
    schemeId,
    activeScheme,
    setSchemeId,
    categories,
    setCategories,
    contextBefore,
    setContextBefore,
    contextAfter,
    setContextAfter,
    categoryColorMap,
    stepDone,
    segmentation,
    setSegmentation,
    outputType,
    setOutputType,
    scale,
    setScale,
    windowSeconds,
    setWindowSeconds,
    perSpeaker,
    setPerSpeaker,
  } = useSession();

  const schemesNav = CODING_SCHEMES.filter((sc) => sc.id !== "custom");
  const ctxUnit = segmentation === "time" ? "window" : "turn";

  const meta = activeScheme
    ? `${activeScheme.label} · ${categories.length} · ${contextBefore}+${contextAfter} ${ctxUnit} context`
    : schemeId === "custom"
    ? `Custom · ${categories.length} · ${contextBefore}+${contextAfter} ${ctxUnit} context`
    : "No scheme selected";

  const handleAdd = () => {
    setCategories([...categories, { name: "", description: "" }]);
  };

  return (
    <SectionShell
      id="s-scheme"
      number="03"
      label="Scheme"
      title="Tell it what to look for."
      description="A coding scheme is the rulebook: categories, their definitions, and how to break ties when a turn fits more than one. Edit categories inline, or paste in your own codebook. Context window controls how much prior conversation the model sees when coding each turn."
      cardTitle="Scheme"
      cardMeta={meta}
      state={stepDone[2] ? "done" : "idle"}
    >
      <div className={s.grid}>
        <nav className={s.nav}>
          {schemesNav.map((sc) => {
            const isActive = schemeId === sc.id;
            const disabled = !!sc.comingSoon;
            return (
              <button
                key={sc.id}
                type="button"
                disabled={disabled}
                onClick={() => !disabled && setSchemeId(sc.id)}
                className={`${s.navItem} ${isActive ? s.navItemActive : ""} ${disabled ? s.navItemDisabled : ""}`}
              >
                <div className={s.navItemTitle}>{sc.label}</div>
                <div className={s.navItemSub}>
                  {sc.description}
                </div>
                {sc.comingSoon && (
                  <span className={s.navItemSoon}>SOON</span>
                )}
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => setSchemeId("custom")}
            className={`${s.navItem} ${s.navItemCustom} ${schemeId === "custom" ? s.navItemActive : ""}`}
          >
            <div className={s.navItemTitle}>+ Custom</div>
            <div className={s.navItemSub}>Build from scratch</div>
          </button>
        </nav>

        <div className={s.pane}>
          {activeScheme || schemeId === "custom" ? (
            <div className={s.steps}>
              <StepBlock
                n={1}
                title="Categories"
                subtitle={
                  activeScheme?.description ??
                  (schemeId === "custom"
                    ? "Define your own codes from scratch."
                    : undefined)
                }
              >
                <div className={s.paneHead}>
                  <div className={s.paneSub}>
                    {categories.length} categor
                    {categories.length === 1 ? "y" : "ies"}
                    <span className={s.paneSubDim}> · click to expand</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleAdd}
                    className={s.addBtn}
                  >
                    + Add
                  </button>
                </div>

                {categories.length > 0 ? (
                  <div className={s.catList}>
                    {categories.map((cat, i) => (
                      <CategoryRow
                        key={i}
                        cat={cat}
                        color={
                          categoryColorMap[cat.name] ?? FALLBACK_COLOR
                        }
                        onUpdate={(next) => {
                          const updated = categories.map((c, idx) =>
                            idx === i ? next : c,
                          );
                          setCategories(updated);
                        }}
                        onRemove={() => {
                          setCategories(
                            categories.filter((_, idx) => idx !== i),
                          );
                        }}
                      />
                    ))}
                  </div>
                ) : (
                  <div className={s.emptyCats}>
                    No categories yet — use <strong>+ Add</strong> to define
                    the codes the model can choose.
                  </div>
                )}
              </StepBlock>

              <StepBlock
                n={2}
                title="Prompt & coding type"
                subtitle="Choose how the transcript is split and what the model returns, then review the prompt it will run."
              >
                <div className={s.typeRow}>
                  <div className={s.typeGroup}>
                    <span className={s.typeLabel}>Segment by</span>
                    <div className={s.toggle}>
                      {(["turn", "utterance", "time"] as const).map((seg) => (
                        <button
                          key={seg}
                          type="button"
                          className={`${s.toggleBtn} ${segmentation === seg ? s.toggleBtnActive : ""}`}
                          onClick={() => setSegmentation(seg)}
                        >
                          {seg}
                          <InfoDot tip={SEGMENT_INFO[seg]} />
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className={s.typeGroup}>
                    <span className={s.typeLabel}>Output</span>
                    <div className={s.toggle}>
                      <button
                        type="button"
                        className={`${s.toggleBtn} ${outputType === "categorical" ? s.toggleBtnActive : ""}`}
                        onClick={() => setOutputType("categorical")}
                      >
                        category
                        <InfoDot tip={OUTPUT_INFO.categorical} />
                      </button>
                      <button
                        type="button"
                        className={`${s.toggleBtn} ${outputType === "continuous" ? s.toggleBtnActive : ""}`}
                        onClick={() => setOutputType("continuous")}
                      >
                        rating
                        <InfoDot tip={OUTPUT_INFO.continuous} />
                      </button>
                    </div>
                  </div>
                  {segmentation === "time" && (
                    <div className={s.typeGroup}>
                      <span className={s.typeLabel}>Per speaker</span>
                      <div className={s.toggle}>
                        <button
                          type="button"
                          className={`${s.toggleBtn} ${perSpeaker ? s.toggleBtnActive : ""}`}
                          onClick={() => setPerSpeaker(true)}
                        >
                          per speaker
                          <InfoDot tip={PER_SPEAKER_INFO.on} />
                        </button>
                        <button
                          type="button"
                          className={`${s.toggleBtn} ${!perSpeaker ? s.toggleBtnActive : ""}`}
                          onClick={() => setPerSpeaker(false)}
                        >
                          combined
                          <InfoDot tip={PER_SPEAKER_INFO.off} />
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <PromptEditor />

                {outputType === "continuous" && (
                  <div className={s.scaleBlock}>
                    <div className={s.scaleHead}>Rating scale</div>
                    <div className={s.scaleGrid}>
                      <label className={s.scaleField}>
                        <span>Min</span>
                        <input
                          type="number"
                          value={scale.min}
                          onChange={(e) =>
                            setScale({ ...scale, min: Number(e.target.value) })
                          }
                        />
                      </label>
                      <label className={s.scaleField}>
                        <span>Max</span>
                        <input
                          type="number"
                          value={scale.max}
                          onChange={(e) =>
                            setScale({ ...scale, max: Number(e.target.value) })
                          }
                        />
                      </label>
                      <label className={s.scaleField}>
                        <span>Low anchor</span>
                        <input
                          type="text"
                          value={scale.minLabel ?? ""}
                          placeholder="e.g. not present"
                          onChange={(e) =>
                            setScale({ ...scale, minLabel: e.target.value })
                          }
                        />
                      </label>
                      <label className={s.scaleField}>
                        <span>High anchor</span>
                        <input
                          type="text"
                          value={scale.maxLabel ?? ""}
                          placeholder="e.g. strongly present"
                          onChange={(e) =>
                            setScale({ ...scale, maxLabel: e.target.value })
                          }
                        />
                      </label>
                    </div>
                    <p className={s.scaleHint}>
                      Each behavior above is rated independently on this scale.
                      The range and anchors are added to the prompt
                      automatically.
                    </p>
                  </div>
                )}

                {segmentation === "time" && (
                  <div className={s.sliderBlock}>
                    <div className={s.sliderRow}>
                      <label className={s.sliderLabel}>Window size</label>
                      <input
                        type="number"
                        min={5}
                        max={600}
                        step={5}
                        value={windowSeconds}
                        onChange={(e) =>
                          setWindowSeconds(Number(e.target.value))
                        }
                        className={s.windowInput}
                      />
                      <div className={s.sliderVal}>seconds</div>
                    </div>
                    <p className={s.sliderHint}>
                      The conversation is split into fixed{" "}
                      <strong>{windowSeconds}-second</strong> windows; each
                      window — which may include both speakers — is coded as one
                      unit.
                    </p>
                  </div>
                )}
              </StepBlock>

              <StepBlock
                n={3}
                title="Context"
                subtitle="How much of the surrounding conversation the model sees when coding each unit."
                last
              >
                <div className={s.ctxBlock}>
                  <div className={s.ctxRow}>
                    <label className={s.ctxField}>
                      <span className={s.ctxFieldLabel}>{ctxUnit}s before</span>
                      <input
                        type="number"
                        min={0}
                        max={20}
                        value={contextBefore}
                        onChange={(e) =>
                          setContextBefore(
                            Math.max(0, Math.min(20, Math.floor(+e.target.value) || 0)),
                          )
                        }
                        className={s.ctxInput}
                      />
                    </label>
                    <span className={s.ctxPlus} aria-hidden>
                      +
                    </span>
                    <label className={s.ctxField}>
                      <span className={s.ctxFieldLabel}>{ctxUnit}s after</span>
                      <input
                        type="number"
                        min={0}
                        max={20}
                        value={contextAfter}
                        onChange={(e) =>
                          setContextAfter(
                            Math.max(0, Math.min(20, Math.floor(+e.target.value) || 0)),
                          )
                        }
                        className={s.ctxInput}
                      />
                    </label>
                  </div>
                  <p className={s.sliderHint}>
                    {contextBefore === 0 && contextAfter === 0 ? (
                      <>
                        Each {ctxUnit} is coded on its own — the model sees{" "}
                        <strong>no surrounding {ctxUnit}s</strong>.
                      </>
                    ) : (
                      <>
                        The model also sees{" "}
                        <strong>
                          {contextBefore} {ctxUnit}
                          {contextBefore !== 1 ? "s" : ""} before
                        </strong>{" "}
                        and{" "}
                        <strong>
                          {contextAfter} {ctxUnit}
                          {contextAfter !== 1 ? "s" : ""} after
                        </strong>{" "}
                        each one it codes, so it can read escalation and repair
                        and tell whether a turn was answered, ignored, or
                        escalated.
                      </>
                    )}
                  </p>
                </div>

                {activeScheme?.id === "vtcs" && <TopicTable />}
              </StepBlock>
            </div>
          ) : (
            <div className={s.empty}>
              <div className={s.emptyTitle}>Pick a scheme →</div>
              <div className={s.emptyDesc}>
                Start with VCTS for the 6-code couple-conflict scheme, or
                Custom to build your own categories from scratch.
              </div>
            </div>
          )}
        </div>
      </div>
    </SectionShell>
  );
}
