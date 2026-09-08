/**
 * WHAT:    Orders coded units the way a reader expects: by turn number, then by
 *          utterance index inside a turn; time windows (no turn number) by start time.
 * STEP:    Run — client side. Used by the results card and the CSV export.
 * RUNS ON: both (pure function)
 */
import { CodedUnit } from "@/lib/types";

export function sortUnits(units: CodedUnit[]): CodedUnit[] {
  return [...units].sort((a, b) => {
    // Time windows have no turnNumber — order those by start time.
    if (a.turnNumber === undefined || b.turnNumber === undefined) {
      if (a.startTime !== b.startTime) return a.startTime - b.startTime;
    } else if (a.turnNumber !== b.turnNumber) {
      return a.turnNumber - b.turnNumber;
    }
    const au = a.utteranceIndex ?? 0;
    const bu = b.utteranceIndex ?? 0;
    return au - bu;
  });
}
