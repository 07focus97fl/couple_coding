import { CodedUnit, ColumnKey, COLUMN_DEFINITIONS } from "./types";

function escapeCsvField(field: string): string {
  if (field.includes(",") || field.includes('"') || field.includes("\n")) {
    return `"${field.replace(/"/g, '""')}"`;
  }
  return field;
}

function getCellValue(unit: CodedUnit, key: ColumnKey): string {
  switch (key) {
    case "unitId":
      return escapeCsvField(unit.unitId);
    case "turnNumber":
      return String(unit.turnNumber);
    case "utteranceIndex":
      return unit.utteranceIndex !== undefined ? String(unit.utteranceIndex) : "";
    case "speaker":
      return escapeCsvField(unit.speaker);
    case "text":
      return escapeCsvField(unit.text);
    case "wordCount":
      return String(unit.wordCount);
    case "category":
      return escapeCsvField(unit.category);
    case "subcategory":
      return escapeCsvField(unit.subcategory ?? "");
    case "alternativesConsidered":
      return escapeCsvField((unit.alternativesConsidered ?? []).join("; "));
    case "rationale":
      return escapeCsvField(unit.rationale);
    case "startTime":
      return unit.startTime.toFixed(3);
    case "endTime":
      return unit.endTime.toFixed(3);
  }
}

export function generateCsv(units: CodedUnit[], visibleColumns?: ColumnKey[]): string {
  const cols = visibleColumns
    ? COLUMN_DEFINITIONS.filter((c) => visibleColumns.includes(c.key))
    : COLUMN_DEFINITIONS;

  const header = cols.map((c) => c.csvHeader).join(",");
  const rows = units.map((u) => cols.map((c) => getCellValue(u, c.key)).join(","));
  return [header, ...rows].join("\n");
}
