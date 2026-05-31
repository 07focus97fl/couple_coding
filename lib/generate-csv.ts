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
      return unit.turnNumber !== undefined ? String(unit.turnNumber) : "";
    case "utteranceIndex":
      return unit.utteranceIndex !== undefined ? String(unit.utteranceIndex) : "";
    case "speaker":
      return escapeCsvField(unit.speaker ?? (unit.speakers ?? []).join("; "));
    case "text":
      return escapeCsvField(unit.text);
    case "wordCount":
      return String(unit.wordCount);
    case "category":
      return escapeCsvField(unit.category ?? "");
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

// Columns that only make sense for categorical output; dropped in continuous mode.
const CATEGORICAL_ONLY: ColumnKey[] = [
  "category",
  "subcategory",
  "alternativesConsidered",
];

/**
 * The dimension names carried by the units' ratings (continuous mode), in their
 * stored order (which matches the scheme's category order). Returns undefined
 * when no unit carries ratings — i.e. categorical output.
 */
export function dimsFromUnits(units: CodedUnit[]): string[] | undefined {
  const u = units.find((x) => x.ratings && Object.keys(x.ratings).length > 0);
  return u ? Object.keys(u.ratings!) : undefined;
}

export function generateCsv(
  units: CodedUnit[],
  visibleColumns?: ColumnKey[],
  dimensionNames?: string[],
): string {
  const isContinuous = !!(dimensionNames && dimensionNames.length > 0);

  let cols = visibleColumns
    ? COLUMN_DEFINITIONS.filter((c) => visibleColumns.includes(c.key))
    : COLUMN_DEFINITIONS;
  if (isContinuous) {
    cols = cols.filter((c) => !CATEGORICAL_ONLY.includes(c.key));
  }

  const dimHeaders = isContinuous
    ? dimensionNames!.map((d) => escapeCsvField(`rating_${d}`))
    : [];
  const header = [...cols.map((c) => c.csvHeader), ...dimHeaders].join(",");
  const rows = units.map((u) => {
    const base = cols.map((c) => getCellValue(u, c.key));
    const ratingCells = isContinuous
      ? dimensionNames!.map((d) =>
          u.ratings?.[d] !== undefined ? String(u.ratings[d]) : "",
        )
      : [];
    return [...base, ...ratingCells].join(",");
  });
  return [header, ...rows].join("\n");
}
