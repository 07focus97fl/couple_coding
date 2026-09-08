"use client";
/**
 * WHAT:    Puts the single CodingSession object into React context so every
 *          component can read it with useSession() instead of prop drilling.
 * STEP:    Shared.
 * RUNS ON: client
 */

import { createContext, useContext, ReactNode } from "react";
import { CodingSession, useCodingSession } from "./useCodingSession";

const CodingSessionContext = createContext<CodingSession | null>(null);

export function CodingSessionProvider({ children }: { children: ReactNode }) {
  const session = useCodingSession();
  return (
    <CodingSessionContext.Provider value={session}>
      {children}
    </CodingSessionContext.Provider>
  );
}

export function useSession(): CodingSession {
  const ctx = useContext(CodingSessionContext);
  if (!ctx) {
    throw new Error(
      "useSession must be used within a CodingSessionProvider",
    );
  }
  return ctx;
}
