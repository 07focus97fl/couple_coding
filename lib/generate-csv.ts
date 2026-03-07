import { CodedTurn, ColumnKey, COLUMN_DEFINITIONS } from "./types";

function escapeCsvField(field: string): string {
  if (field.includes(",") || field.includes('"') || field.includes("\n")) {
    return `"${field.replace(/"/g, '""')}"`;
  }
  return field;
}

function getCellValue(turn: CodedTurn, key: ColumnKey): string {
  switch (key) {
    case "turnNumber":
      return String(turn.turnNumber);
    case "speaker":
      return escapeCsvField(turn.speaker);
    case "text":
      return escapeCsvField(turn.text);
    case "wordCount":
      return String(turn.wordCount);
    case "category":
      return escapeCsvField(turn.category);
    case "startTime":
      return turn.startTime.toFixed(3);
    case "endTime":
      return turn.endTime.toFixed(3);
  }
}

export function generateCsv(turns: CodedTurn[], visibleColumns?: ColumnKey[]): string {
  const cols = visibleColumns
    ? COLUMN_DEFINITIONS.filter((c) => visibleColumns.includes(c.key))
    : COLUMN_DEFINITIONS;

  const header = cols.map((c) => c.csvHeader).join(",");
  const rows = turns.map((t) => cols.map((c) => getCellValue(t, c.key)).join(","));
  return [header, ...rows].join("\n");
}
