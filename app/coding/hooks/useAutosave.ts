"use client";

import { useEffect, useState } from "react";
import {
  AUTOSAVE_KEY,
  AUTOSAVE_MAX_BYTES,
  PersistedSession,
  serialize,
  stripRawTranscripts,
} from "@/lib/autosave-schema";

export type AutosaveState =
  | "idle"
  | "saving"
  | "saved"
  | "metadata-only"
  | "error";

export function useAutosave(
  session: PersistedSession | null,
  enabled: boolean,
): AutosaveState {
  const [state, setState] = useState<AutosaveState>("idle");

  useEffect(() => {
    if (!session || !enabled) return;
    setState("saving");
    const handle = window.setTimeout(() => {
      try {
        const blob = serialize(session);
        if (blob.length <= AUTOSAVE_MAX_BYTES) {
          localStorage.setItem(AUTOSAVE_KEY, blob);
          setState("saved");
          return;
        }
        const light = serialize(stripRawTranscripts(session));
        localStorage.setItem(AUTOSAVE_KEY, light);
        setState("metadata-only");
      } catch {
        setState("error");
      }
    }, 800);
    return () => window.clearTimeout(handle);
  }, [session, enabled]);

  return state;
}
