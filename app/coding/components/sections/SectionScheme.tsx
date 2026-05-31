"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSession } from "../../hooks/CodingSessionContext";
import { SectionShell } from "../layout/SectionShell";
import { CODING_SCHEMES } from "@/lib/coding-schemes";
import { CategoryDefinition } from "@/lib/types";
import { codeFor, FALLBACK_COLOR } from "@/lib/category-colors";
import { PromptEditor } from "./PromptEditor";
import { TopicTable } from "./TopicTable";
import s from "./SectionScheme.module.css";

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
  nameEditable,
  onUpdate,
  onRemove,
}: {
  cat: CategoryDefinition;
  color: string;
  nameEditable: boolean;
  onUpdate: (next: CategoryDefinition) => void;
  onRemove: () => void;
}) {
  const [open, setOpen] = useState(false);
  const descRef = useRef<HTMLTextAreaElement>(null);

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
          <span className={s.rowName}>{cat.name || "Untitled"}</span>
          {!open && cat.description && (
            <span className={s.rowPreview}>{cat.description}</span>
          )}
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
          {nameEditable && (
            <input
              className={s.codeInput}
              value={cat.name}
              placeholder="Code (e.g. DEN)"
              spellCheck={false}
              onChange={(e) => onUpdate({ ...cat, name: e.target.value })}
            />
          )}
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

export function SectionScheme() {
  const {
    schemeId,
    activeScheme,
    setSchemeId,
    categories,
    setCategories,
    contextWindow,
    setContextWindow,
    categoryColorMap,
    stepDone,
  } = useSession();

  const schemesNav = CODING_SCHEMES.filter((sc) => sc.id !== "custom");

  const meta = activeScheme
    ? `${activeScheme.label} · ${categories.length} · ${contextWindow}-turn context`
    : schemeId === "custom"
    ? `Custom · ${categories.length} · ${contextWindow}-turn context`
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
            <>
              <div className={s.paneHead}>
                <div>
                  <h3 className={s.paneTitle}>
                    {activeScheme?.description ??
                      (schemeId === "custom" ? "Custom scheme" : "")}
                  </h3>
                  <div className={s.paneSub}>
                    {categories.length} categor
                    {categories.length === 1 ? "y" : "ies"}
                    <span className={s.paneSubDim}> · click to expand</span>
                  </div>
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
                      nameEditable={schemeId === "custom"}
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

              <PromptEditor />

              <div className={s.sliderBlock}>
                <div className={s.sliderRow}>
                  <label className={s.sliderLabel}>Context window</label>
                  <input
                    type="range"
                    min={0}
                    max={20}
                    value={contextWindow}
                    onChange={(e) => setContextWindow(+e.target.value)}
                    className={s.slider}
                  />
                  <div className={s.sliderVal}>
                    {contextWindow} turn{contextWindow !== 1 ? "s" : ""}
                  </div>
                </div>
                <p className={s.sliderHint}>
                  {contextWindow === 0 ? (
                    <>
                      Each turn is coded <strong>on its own</strong> — no
                      earlier conversation is shown to the model.
                    </>
                  ) : (
                    <>
                      The model also sees the{" "}
                      <strong>
                        {contextWindow} turn{contextWindow !== 1 ? "s" : ""}{" "}
                        before
                      </strong>{" "}
                      each one it codes, so it can read escalation, repair, and
                      who&apos;s responding to whom — not just the turn on its
                      own.
                    </>
                  )}
                </p>
              </div>
            </>
          ) : (
            <div className={s.empty}>
              <div className={s.emptyTitle}>Pick a scheme →</div>
              <div className={s.emptyDesc}>
                Start with VCTS for the 6-code couple-conflict scheme,
                Valence for quick positive/negative classification, or
                Custom to build from scratch.
              </div>
            </div>
          )}
        </div>
      </div>

      {activeScheme?.id === "vtcs" && <TopicTable />}
    </SectionShell>
  );
}
