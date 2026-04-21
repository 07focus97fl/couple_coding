"use client";

import { useSession } from "../../hooks/CodingSessionContext";
import { PromptBlocksForm } from "../PromptBlocksForm";
import { PromptPreview } from "../PromptPreview";
import pbs from "../prompt-blocks.module.css";
import s from "./RulesDrawer.module.css";

function XIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

export function RulesDrawer() {
  const {
    rulesOpen,
    setRulesOpen,
    activeScheme,
    granularity,
    setGranularity,
    categories,
    setCategories,
    categoriesDirty,
    resetCategories,
    blocks,
    dirty,
    updateBlock,
    resetBlock,
    contextWindow,
    files,
    rawSystemOverride,
    commitRawOverride,
    revertRawOverride,
  } = useSession();

  if (!rulesOpen) return null;

  return (
    <div
      className={s.scrim}
      onClick={(e) => {
        if (e.target === e.currentTarget) setRulesOpen(false);
      }}
    >
      <aside className={s.drawer}>
        <div className={s.head}>
          <div>
            <div className={s.eyebrow}>RULES & PROMPT</div>
            <h2 className={s.title}>Tune the exact prompt the model sees</h2>
          </div>
          <button
            type="button"
            onClick={() => setRulesOpen(false)}
            className={s.closeBtn}
            aria-label="Close"
          >
            <XIcon />
          </button>
        </div>

        <div className={s.body}>
          {rawSystemOverride !== null && (
            <div className={pbs.overrideBanner}>
              <div className={pbs.overrideBannerText}>
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
                Raw prompt override active — block edits below are ignored.
              </div>
              <button
                type="button"
                className={pbs.overrideRevertBtn}
                onClick={revertRawOverride}
              >
                Revert to blocks
              </button>
            </div>
          )}

          {activeScheme ? (
            <PromptBlocksForm
              granularity={granularity}
              onGranularityChange={setGranularity}
              scheme={activeScheme}
              categories={categories}
              onCategoriesChange={setCategories}
              categoriesDirty={categoriesDirty}
              onCategoriesReset={resetCategories}
              blocks={blocks}
              dirty={dirty}
              onBlockChange={updateBlock}
              onBlockReset={resetBlock}
              disabled={rawSystemOverride !== null}
            />
          ) : (
            <div className={s.empty}>
              Select a scheme from Section 03 first to edit its rules.
            </div>
          )}

          {activeScheme && (
            <PromptPreview
              granularity={granularity}
              blocks={blocks}
              categories={categories}
              contextWindow={contextWindow}
              files={files}
              rawSystemOverride={rawSystemOverride}
              onCommitRawOverride={commitRawOverride}
              onRevertRawOverride={revertRawOverride}
            />
          )}
        </div>
      </aside>
    </div>
  );
}
