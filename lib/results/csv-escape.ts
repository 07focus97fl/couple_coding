/**
 * WHAT:    The one CSV cell escaper: quotes a cell when it holds a comma, a
 *          quote, or a line break, doubling inner quotes (RFC 4180).
 * STEP:    Run (every CSV export).
 * RUNS ON: both (pure functions)
 */

export function escapeCsvField(field: string): string {
  if (/[",\r\n]/.test(field)) {
    return `"${field.replace(/"/g, '""')}"`;
  }
  return field;
}

/** One CSV line from raw cells. */
export function csvLine(cells: string[]): string {
  return cells.map(escapeCsvField).join(",");
}
