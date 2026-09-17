/**
 * WHAT:    Human-vs-model agreement for a CSV-origin conversation: the per-unit
 *          agree cell (shared with the audit CSV so the screen and the file
 *          never disagree), the agreement rate, and a human x model confusion
 *          table. Blank human codes and unparsable model rows are left out.
 * STEP:    Run (results cards, the run summary, the audit export).
 * RUNS ON: both (pure functions)
 */
import type { CodedUnit, CsvSource } from "@/lib/types";
import { humanCodeAt } from "@/lib/transcript/csv-conversations";

export interface Agreement {
  /** Units that had both a human code and a model code. */
  n: number;
  matches: number;
  /** 0..100 */
  pct: number;
  /** human code -> model code -> count */
  confusion: Record<string, Record<string, number>>;
}

function norm(code: string): string {
  return code.trim().toUpperCase();
}

/**
 * "1" when the model's category equals the human code (case-insensitive, trimmed),
 * "0" when it differs, "" when there is nothing to compare: no human code, a
 * parse-error row, or no category (continuous output).
 */
export function agreeCell(humanCode: string, unit: CodedUnit): "" | "0" | "1" {
  const h = norm(humanCode);
  if (!h || unit.error || !unit.category) return "";
  return norm(unit.category) === h ? "1" : "0";
}

/** The human code for a coded unit's turn, or "" when there is none. */
export function humanCodeFor(source: CsvSource, unit: CodedUnit): string {
  return unit.turnNumber === undefined ? "" : humanCodeAt(source, unit.turnNumber);
}

/**
 * Score every coded unit of one conversation against its row's human code.
 * Each unit is one observation, so in utterance mode every utterance is
 * compared with its turn's code. Returns null when the CSV had no code column.
 */
export function computeAgreement(
  source: CsvSource,
  units: CodedUnit[],
): Agreement | null {
  if (!source.keys.humanCode) return null;
  const confusion: Record<string, Record<string, number>> = {};
  let n = 0;
  let matches = 0;
  for (const u of units) {
    const human = humanCodeFor(source, u);
    const cell = agreeCell(human, u);
    if (cell === "") continue;
    n++;
    if (cell === "1") matches++;
    const h = human.trim();
    const m = (u.category ?? "").trim();
    const row = (confusion[h] ??= {});
    row[m] = (row[m] ?? 0) + 1;
  }
  return { n, matches, pct: n > 0 ? (matches / n) * 100 : 0, confusion };
}

/** Sum several conversations' agreements into one. */
export function mergeAgreements(list: Agreement[]): Agreement {
  const confusion: Record<string, Record<string, number>> = {};
  let n = 0;
  let matches = 0;
  for (const a of list) {
    n += a.n;
    matches += a.matches;
    for (const [h, row] of Object.entries(a.confusion)) {
      const target = (confusion[h] ??= {});
      for (const [m, count] of Object.entries(row)) {
        target[m] = (target[m] ?? 0) + count;
      }
    }
  }
  return { n, matches, pct: n > 0 ? (matches / n) * 100 : 0, confusion };
}
