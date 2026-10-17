/**
 * WHAT:    Turns an uploaded human-coded CSV into conversations (one CsvSource
 *          per exchange_id prefix) and builds the speaking turns of each one.
 *          Required columns: exchange_id, speaker, text. Optional: topic,
 *          final_code, start_time and end_time (seconds, or m:ss / h:mm:ss,
 *          measured from the start of the conversation). Every other column is
 *          kept and written back on export.
 * STEP:    Upload (import) and Run (audit export reads the same rows).
 * RUNS ON: both (pure functions)
 */
import { CsvRow, CsvSource, SpeakingTurn } from "@/lib/types";
import { parseCsv } from "./parse-csv";

const REQUIRED = ["exchange_id", "speaker", "text"] as const;
const OPTIONAL = ["topic", "final_code", "start_time", "end_time"] as const;

/** `mcn_fsu_4221_1_17` -> `mcn_fsu_4221_1`; an id without a `_N` suffix is its own conversation. */
export function conversationIdOf(exchangeId: string): string {
  const m = /^(.*)_\d+$/.exec(exchangeId.trim());
  return m ? m[1] : exchangeId.trim();
}

/**
 * A time cell in seconds: "12.4", "0:12", "00:12.5" or "1:02:03". Blank -> null.
 * Anything else -> NaN, which the importer reports as an error.
 */
export function parseTimeCell(cell: string | undefined): number | null {
  const t = (cell ?? "").trim();
  if (!t) return null;
  if (/^\d+(\.\d+)?$/.test(t)) return Number(t);
  const m = /^(?:(\d+):)?(\d{1,2}):(\d{1,2}(?:\.\d+)?)$/.exec(t);
  if (!m) return NaN;
  const [, h, min, sec] = m;
  return Number(h ?? 0) * 3600 + Number(min) * 60 + Number(sec);
}

/** Find the header cell matching `wanted` ignoring case and surrounding spaces. */
function findColumn(header: string[], wanted: string): string | undefined {
  return header.find((h) => h.trim().toLowerCase() === wanted);
}

/**
 * Group the rows of a CSV by conversation, in first-appearance order. Throws
 * with a message naming the file and the problem when a required column is
 * missing or a row has no exchange_id / speaker.
 */
export function csvToConversations(fileName: string, text: string): CsvSource[] {
  let parsed;
  try {
    parsed = parseCsv(text);
  } catch (err) {
    throw new Error(
      `"${fileName}": ${err instanceof Error ? err.message : "could not be parsed as CSV."}`,
    );
  }
  const { header, rows } = parsed;
  if (header.length === 0 || rows.length === 0) {
    throw new Error(`"${fileName}": the file has no data rows.`);
  }

  const found: Record<string, string | undefined> = {};
  for (const name of [...REQUIRED, ...OPTIONAL]) {
    found[name] = findColumn(header, name);
  }
  for (const name of REQUIRED) {
    if (!found[name]) {
      throw new Error(
        `"${fileName}": missing required column "${name}" (found: ${header.join(", ")}).`,
      );
    }
  }
  const keys: CsvSource["keys"] = {
    exchangeId: found.exchange_id!,
    speaker: found.speaker!,
    text: found.text!,
    topic: found.topic,
    humanCode: found.final_code,
    startTime: found.start_time,
    endTime: found.end_time,
  };

  const groups = new Map<string, CsvRow[]>();
  rows.forEach((cells, i) => {
    const values: Record<string, string> = {};
    header.forEach((h, c) => {
      values[h] = cells[c] ?? "";
    });
    const rowIndex = i + 1;
    const exchangeId = values[keys.exchangeId].trim();
    if (!exchangeId) {
      throw new Error(`"${fileName}" row ${rowIndex}: empty ${keys.exchangeId}.`);
    }
    if (!values[keys.speaker].trim()) {
      throw new Error(`"${fileName}" row ${rowIndex}: empty ${keys.speaker}.`);
    }
    for (const key of [keys.startTime, keys.endTime]) {
      if (key && Number.isNaN(parseTimeCell(values[key]))) {
        throw new Error(
          `"${fileName}" row ${rowIndex}: ${key} "${values[key]}" is not a time ` +
            `(use seconds such as 12.4, or m:ss such as 0:12).`,
        );
      }
    }
    const id = conversationIdOf(exchangeId);
    const list = groups.get(id);
    const row: CsvRow = { rowIndex, values };
    if (list) list.push(row);
    else groups.set(id, [row]);
  });

  return Array.from(groups, ([conversationId, convRows]) => ({
    fileName,
    conversationId,
    columns: [...header],
    keys,
    rows: convRows,
  }));
}

/**
 * One speaking turn per row, in row order. `turnNumber` is the 1-based position
 * within the conversation (not the exchange_id suffix, which can have gaps).
 * Times come from start_time / end_time when the CSV has them. A missing end
 * is taken from the next row's start (else the turn's own start), so a first
 * turn at 0:00 still counts as timed. Without a start_time the times are 0 and
 * the model sees no timestamp. An empty text still becomes a turn so the
 * rows[i] <-> turns[i] invariant holds.
 */
export function turnsFromCsv(source: CsvSource): SpeakingTurn[] {
  const { keys } = source;
  const cell = (i: number, key?: string) =>
    key ? parseTimeCell(source.rows[i]?.values[key]) : null;
  return source.rows.map((r, i) => {
    const text = (r.values[keys.text] ?? "").trim();
    const start = cell(i, keys.startTime);
    const end = cell(i, keys.endTime) ?? cell(i + 1, keys.startTime) ?? start;
    return {
      turnNumber: i + 1,
      speaker: r.values[keys.speaker].trim(),
      text,
      wordCount: text ? text.split(/\s+/).length : 0,
      startTime: start ?? 0,
      endTime: start === null ? 0 : Math.max(start, end ?? start),
    };
  });
}

/** The conversation's topic: the first non-blank topic cell, else "". */
export function topicOf(source: CsvSource): string {
  const key = source.keys.topic;
  if (!key) return "";
  for (const r of source.rows) {
    const t = (r.values[key] ?? "").trim();
    if (t) return t;
  }
  return "";
}

/** The human code for the turn at `turnNumber`, or "" (no column, or blank cell). */
export function humanCodeAt(source: CsvSource, turnNumber: number): string {
  const key = source.keys.humanCode;
  if (!key) return "";
  return (source.rows[turnNumber - 1]?.values[key] ?? "").trim();
}
