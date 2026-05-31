"use client";

import { useSession } from "../../hooks/CodingSessionContext";
import { scrollToSection } from "../../hooks/useScrollSpy";
import s from "./StageRail.module.css";

const STAGES = [
  { id: "s-upload", n: "01", label: "Upload" },
  { id: "s-model", n: "02", label: "Model" },
  { id: "s-scheme", n: "03", label: "Scheme" },
  { id: "s-run", n: "04", label: "Run" },
] as const;

function CheckSvg() {
  return (
    <svg width="11" height="11" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M3 8l3.5 3.5L13 5"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function StageRail() {
  const { activeSectionId, stepDone, activeProviderKey } = useSession();

  const keyLinked = activeProviderKey !== "";

  return (
    <aside className={s.rail}>
      <nav aria-label="Workspace steps">
        <div className={s.eyebrow}>Workspace</div>
        <ol className={s.list}>
          {STAGES.map((stage, i) => {
            const active = activeSectionId === stage.id;
            const done = stepDone[i];
            const state = active ? "active" : done ? "done" : "idle";
            return (
              <li key={stage.id}>
                <button
                  type="button"
                  onClick={() => scrollToSection(stage.id)}
                  className={s.item}
                  data-state={state}
                  aria-current={active ? "step" : undefined}
                >
                  <span className={s.marker} data-state={state}>
                    {done ? <CheckSvg /> : stage.n.replace(/^0/, "")}
                  </span>
                  <span className={s.label}>{stage.label}</span>
                </button>
              </li>
            );
          })}
        </ol>
      </nav>

      <div className={s.env}>
        <div className={s.envStatus}>
          <span
            className={`${s.keyDot} ${keyLinked ? s.keyDotOk : s.keyDotNone}`}
          />
          {keyLinked ? "Key linked" : "No key"}
        </div>
      </div>
    </aside>
  );
}
