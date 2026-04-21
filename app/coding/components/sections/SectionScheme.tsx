"use client";

import { useState } from "react";
import { useSession } from "../../hooks/CodingSessionContext";
import { SectionShell } from "../layout/SectionShell";
import { CODING_SCHEMES } from "@/lib/coding-schemes";
import { CategoryDefinition } from "@/lib/types";
import { codeFor, FALLBACK_COLOR } from "@/lib/category-colors";
import s from "./SectionScheme.module.css";

function firstSentence(text: string): string {
  if (!text) return "";
  const m = text.match(/^(.*?[\.\!\?])(\s|$)/);
  return (m ? m[1] : text).trim();
}

function CategoryCard({
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
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <div className={`${s.card} ${s.cardEditing}`}>
        <input
          className={s.editName}
          value={cat.name}
          placeholder="Code (e.g. DEN)"
          onChange={(e) => onUpdate({ ...cat, name: e.target.value })}
        />
        <textarea
          className={s.editDesc}
          value={cat.description}
          placeholder="Definition / distinguishing rules"
          rows={4}
          onChange={(e) => onUpdate({ ...cat, description: e.target.value })}
        />
        <div className={s.editActions}>
          <button type="button" className={s.removeBtn} onClick={onRemove}>
            Remove
          </button>
          <button
            type="button"
            className={s.doneBtn}
            onClick={() => setEditing(false)}
          >
            Done
          </button>
        </div>
      </div>
    );
  }

  return (
    <button
      type="button"
      className={s.card}
      onClick={() => setEditing(true)}
    >
      <div className={s.cardTop}>
        <span
          className={s.swatch}
          style={{ background: color || FALLBACK_COLOR }}
        >
          {codeFor(cat.name)}
        </span>
        <span className={s.cardName}>{cat.name || "Unnamed"}</span>
      </div>
      <div className={s.cardDesc}>{firstSentence(cat.description)}</div>
    </button>
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
    setRulesOpen,
    stepDone,
    schemeName,
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
      headAction={
        schemeId && !activeScheme?.comingSoon ? (
          <button
            type="button"
            className={s.rulesBtn}
            onClick={() => setRulesOpen(true)}
          >
            Rules
          </button>
        ) : null
      }
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
                    <span className={s.paneSubDim}> · click to edit</span>
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
                <div className={s.catGrid}>
                  {categories.map((cat, i) => (
                    <CategoryCard
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
            </>
          ) : (
            <div className={s.empty}>
              <div className={s.emptyTitle}>Pick a scheme →</div>
              <div className={s.emptyDesc}>
                Start with VTCS for general conflict coding, Valence for
                quick positive/negative classification, or Custom to build
                from scratch.
              </div>
            </div>
          )}
        </div>
      </div>
    </SectionShell>
  );
}
