"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import { ApiLog, ApiLogParsedUnit } from "@/lib/types";
import { PromptViewer } from "@/app/coding/components/PromptViewer";

const LOGS_KEY = "api_logs";
const storageListeners = new Set<() => void>();

function subscribeToLogs(callback: () => void): () => void {
  storageListeners.add(callback);
  return () => {
    storageListeners.delete(callback);
  };
}

function notifyLogsChanged() {
  storageListeners.forEach((cb) => cb());
}

function getLogsSnapshot(): string | null {
  return typeof window === "undefined" ? null : sessionStorage.getItem(LOGS_KEY);
}

function getServerLogsSnapshot(): null {
  return null;
}

export default function LogsPage() {
  const raw = useSyncExternalStore(subscribeToLogs, getLogsSnapshot, getServerLogsSnapshot);
  const logs = useMemo<ApiLog[]>(() => {
    if (!raw) return [];
    try {
      return JSON.parse(raw);
    } catch {
      return [];
    }
  }, [raw]);

  const [expanded, setExpanded] = useState<Record<number, boolean>>({});

  const toggle = (i: number) => setExpanded((prev) => ({ ...prev, [i]: !prev[i] }));

  const clearLogs = () => {
    sessionStorage.removeItem(LOGS_KEY);
    notifyLogsChanged();
  };

  if (logs.length === 0) {
    return (
      <div style={page}>
        <h1 style={heading}>API Logs</h1>
        <p style={{ color: "#8a8680" }}>No logs found. Run a coding job first, then reopen this page.</p>
      </div>
    );
  }

  return (
    <div style={page}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "1.5rem",
        }}
      >
        <h1 style={heading}>API Logs ({logs.length} calls)</h1>
        <button onClick={clearLogs} style={clearBtn}>
          Clear Logs
        </button>
      </div>

      {logs.map((log, i) => {
        const isOpen = expanded[i] ?? false;
        const units: ApiLogParsedUnit[] = log.parsedUnits ?? [];
        // Pre-split logs only had a single prior-context field; read it as a fallback.
        const legacy = log as Partial<{
          contextTurnNumbers: number[];
          contextWindow: number;
        }>;
        const beforeNumbers =
          log.contextBeforeTurnNumbers ?? legacy.contextTurnNumbers ?? [];
        const afterNumbers = log.contextAfterTurnNumbers ?? [];
        const beforeCount = beforeNumbers.length;
        const afterCount = afterNumbers.length;
        const primaryCategory =
          units.length === 1 ? units[0].category : `${units.length} utterances`;
        return (
          <div key={i} style={card}>
            <button onClick={() => toggle(i)} style={cardHeader}>
              <span style={{ fontWeight: 600 }}>
                Turn {log.turnNumber} &middot; {log.speaker}
              </span>
              <span style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                <span style={granularityBadge(log.granularity === "utterance")}>
                  {log.granularity === "utterance" ? "Utterance" : "Turn"}
                </span>
                <span style={badge}>{primaryCategory}</span>
                <span style={{ fontSize: "0.75rem", color: "#8a8680" }}>
                  {(log.unitIds ?? []).join(", ")} &middot; {beforeCount} before / {afterCount} after &middot; attempt {log.attempt + 1} &middot; {log.model}
                </span>
                <span style={{ fontSize: "0.85rem" }}>{isOpen ? "\u25B2" : "\u25BC"}</span>
              </span>
            </button>

            {isOpen && (
              <div style={{ padding: "0 1rem 1rem" }}>
                <div style={contextPanel}>
                  <span style={{ fontWeight: 600 }}>Context sent to model:</span>{" "}
                  {beforeCount === 0 && afterCount === 0 ? (
                    <>none — this turn was coded in isolation</>
                  ) : (
                    <>
                      {beforeCount > 0 ? (
                        <>
                          {beforeCount} prior turn{beforeCount !== 1 ? "s" : ""} (Turn
                          {beforeCount !== 1 ? "s" : ""} {beforeNumbers.join(", ")})
                        </>
                      ) : null}
                      {beforeCount > 0 && afterCount > 0 ? " · " : ""}
                      {afterCount > 0 ? (
                        <>
                          {afterCount} following turn{afterCount !== 1 ? "s" : ""} (Turn
                          {afterCount !== 1 ? "s" : ""} {afterNumbers.join(", ")})
                        </>
                      ) : null}
                    </>
                  )}
                  <span style={{ color: "#8a8680" }}>
                    {" "}
                    &middot; settings:{" "}
                    {log.contextBefore ?? legacy.contextWindow ?? "?"} before /{" "}
                    {log.contextAfter ?? 0} after
                  </span>
                  <div
                    style={{
                      color: "#8a8680",
                      fontSize: "0.72rem",
                      marginTop: "0.3rem",
                    }}
                  >
                    Full text is under <strong>User message</strong> below, in
                    the PRIOR CONTEXT and FOLLOWING CONTEXT blocks.
                  </div>
                </div>

                <div style={{ marginTop: "0.5rem" }}>
                  <PromptViewer
                    systemPrompt={log.systemPrompt}
                    userMessage={log.userMessage}
                    tool={log.toolDefinition}
                  />
                </div>

                <Section title="Parsed units">
                  <div style={parsedUnitsTable}>
                    {units.map((u) => (
                      <div key={u.unitId} style={parsedUnitRow}>
                        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                          <span style={unitIdChip}>{u.unitId}</span>
                          <span style={badge}>{u.category}</span>
                        </div>
                        {u.text && (
                          <div style={utteranceText}>
                            <span style={{ color: "#8a8680", fontSize: "0.7rem" }}>text: </span>
                            {u.text}
                          </div>
                        )}
                        <div style={{ fontSize: "0.78rem", color: "#1a1a1e", marginTop: "0.2rem" }}>
                          <span style={{ color: "#8a8680", fontSize: "0.7rem" }}>rationale: </span>
                          {u.rationale}
                        </div>
                      </div>
                    ))}
                  </div>
                </Section>

                <Section title="Raw API Response">
                  <pre style={pre}>{JSON.stringify(log.rawResponse, null, 2)}</pre>
                </Section>

                <p style={{ fontSize: "0.7rem", color: "#aaa", marginTop: "0.75rem" }}>
                  {log.timestamp}
                </p>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ marginTop: "0.75rem" }}>
      <button onClick={() => setOpen(!open)} style={sectionToggle}>
        <span>{open ? "\u25BE" : "\u25B8"} {title}</span>
      </button>
      {open && <div style={{ marginTop: "0.35rem" }}>{children}</div>}
    </div>
  );
}

// ── Inline styles ──

const page: React.CSSProperties = {
  maxWidth: 960,
  margin: "0 auto",
  padding: "2rem 1.5rem",
  fontFamily: "system-ui, sans-serif",
  background: "#f6f4f0",
  minHeight: "100vh",
  color: "#1a1a1e",
};

const heading: React.CSSProperties = {
  fontSize: "1.3rem",
  fontWeight: 700,
  margin: 0,
};

const clearBtn: React.CSSProperties = {
  background: "none",
  border: "1px solid #e8e4de",
  borderRadius: 8,
  padding: "0.4rem 0.8rem",
  fontSize: "0.78rem",
  color: "#c45d3e",
  cursor: "pointer",
};

const card: React.CSSProperties = {
  background: "#fff",
  borderRadius: 10,
  border: "1px solid #e8e4de",
  marginBottom: "0.5rem",
  overflow: "hidden",
};

const cardHeader: React.CSSProperties = {
  width: "100%",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "0.75rem 1rem",
  background: "none",
  border: "none",
  cursor: "pointer",
  fontSize: "0.88rem",
  color: "#1a1a1e",
  textAlign: "left",
};

const contextPanel: React.CSSProperties = {
  background: "#fbf8f3",
  border: "1px solid #ece8e1",
  borderLeft: "3px solid #c45d3e",
  borderRadius: 8,
  padding: "0.6rem 0.75rem",
  fontSize: "0.8rem",
  color: "#1a1a1e",
  lineHeight: 1.5,
  marginBottom: "0.25rem",
};

const badge: React.CSSProperties = {
  background: "#c45d3e18",
  color: "#c45d3e",
  padding: "0.15rem 0.5rem",
  borderRadius: 6,
  fontSize: "0.75rem",
  fontWeight: 600,
};

function granularityBadge(isUtterance: boolean): React.CSSProperties {
  return {
    background: isUtterance ? "#fff5e8" : "#ece8e1",
    color: isUtterance ? "#8a5a12" : "#8a8680",
    padding: "0.15rem 0.5rem",
    borderRadius: 6,
    fontSize: "0.72rem",
    fontWeight: 600,
    fontFamily: "var(--mono, monospace)",
    letterSpacing: "0.03em",
  };
}

const unitIdChip: React.CSSProperties = {
  fontFamily: "var(--mono, monospace)",
  fontSize: "0.72rem",
  fontWeight: 500,
  background: "#ece8e1",
  color: "#8a8680",
  padding: "0.15rem 0.5rem",
  borderRadius: 100,
};

const sectionToggle: React.CSSProperties = {
  background: "none",
  border: "none",
  cursor: "pointer",
  fontSize: "0.82rem",
  fontWeight: 600,
  color: "#555",
  padding: 0,
};

const pre: React.CSSProperties = {
  background: "#f8f6f2",
  border: "1px solid #e8e4de",
  borderRadius: 8,
  padding: "0.75rem",
  fontSize: "0.72rem",
  overflow: "auto",
  maxHeight: 400,
  whiteSpace: "pre-wrap",
  wordBreak: "break-word",
  marginTop: "0.35rem",
  lineHeight: 1.5,
};

const parsedUnitsTable: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "0.5rem",
};

const parsedUnitRow: React.CSSProperties = {
  background: "#fafaf7",
  border: "1px solid #ece8e1",
  borderRadius: 8,
  padding: "0.6rem 0.75rem",
};

const utteranceText: React.CSSProperties = {
  fontFamily: "var(--mono, monospace)",
  fontSize: "0.78rem",
  color: "#1a1a1e",
  marginTop: "0.3rem",
  whiteSpace: "pre-wrap",
  wordBreak: "break-word",
};
