"use client";

import { useSession } from "../../hooks/CodingSessionContext";
import s from "./Hero.module.css";

function autosaveLabel(state: string): string {
  switch (state) {
    case "saving":
      return "SESSION · SAVING…";
    case "saved":
      return "SESSION · AUTOSAVED";
    case "metadata-only":
      return "SESSION · METADATA ONLY";
    case "error":
      return "SESSION · NOT SAVED";
    default:
      return "SESSION · READY";
  }
}

export function Hero() {
  const { autosaveState } = useSession();
  return (
    <header className={s.hero}>
      <div className={s.eyebrow}>{autosaveLabel(autosaveState)}</div>
      <h1 className={s.title}>Couples coding, end to end.</h1>
      <p className={s.description}>
        Upload transcripts, pick a model, tune your scheme, and code every turn
        with transparent rationale — all on one page.
      </p>
    </header>
  );
}
