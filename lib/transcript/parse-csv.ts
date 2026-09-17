/**
 * WHAT:    A small RFC 4180 CSV reader: header + rows of cells. Handles a UTF-8
 *          BOM, CRLF / LF / bare CR line ends, quoted cells with doubled quotes
 *          and embedded newlines. No dependency.
 * STEP:    Upload (reading a human-coded CSV). Also used by the check script.
 * RUNS ON: both (pure function)
 */

export interface ParsedCsv {
  /** Header cells verbatim (whitespace kept), in file order. */
  header: string[];
  /** One string[] per data row, padded to the header length. */
  rows: string[][];
}

/**
 * Parse CSV text. Rules:
 * - A leading BOM is dropped.
 * - `"` starts a quoted cell; inside it, `""` is a literal quote and line
 *   breaks are kept. Outside quotes, `,` ends a cell and `\r\n`, `\n` or a
 *   bare `\r` ends a record.
 * - A record whose every cell is empty is skipped (trailing blank lines).
 * - A short record is right-padded with ""; a long one throws.
 * - An unterminated quote at end of file throws.
 */
export function parseCsv(text: string): ParsedCsv {
  const src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const records: string[][] = [];
  let record: string[] = [];
  let cell = "";
  let inQuotes = false;
  let i = 0;
  const n = src.length;

  const endCell = () => {
    record.push(cell);
    cell = "";
  };
  const endRecord = () => {
    endCell();
    if (record.some((c) => c !== "")) records.push(record);
    record = [];
  };

  while (i < n) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          cell += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      cell += ch;
      i++;
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      i++;
      continue;
    }
    if (ch === ",") {
      endCell();
      i++;
      continue;
    }
    if (ch === "\r") {
      endRecord();
      i += src[i + 1] === "\n" ? 2 : 1;
      continue;
    }
    if (ch === "\n") {
      endRecord();
      i++;
      continue;
    }
    cell += ch;
    i++;
  }
  if (inQuotes) throw new Error("Unterminated quoted field at end of file.");
  // Flush the last record when the file does not end with a line break.
  if (cell !== "" || record.length > 0) endRecord();

  if (records.length === 0) return { header: [], rows: [] };
  const [header, ...body] = records;
  const width = header.length;
  const rows = body.map((r, idx) => {
    if (r.length > width) {
      throw new Error(
        `Row ${idx + 1} has ${r.length} fields, expected ${width}.`,
      );
    }
    return r.length < width
      ? [...r, ...new Array<string>(width - r.length).fill("")]
      : r;
  });
  return { header, rows };
}
