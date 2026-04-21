"use client";

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
