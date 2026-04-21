import { CategoryDefinition, CodingScheme } from "./types";

export const PALETTE = [
  "#a65a3d",
  "#7b9068",
  "#928457",
  "#7a8a99",
  "#8e88a3",
  "#b69774",
  "#6d7e88",
  "#a88a5e",
  "#8a6f88",
  "#5c7c71",
  "#c18660",
  "#6e8a8c",
  "#907a5c",
  "#9a6d6e",
];

export const FALLBACK_COLOR = "#8a8680";

export function colorFor(
  schemeId: string,
  category: CategoryDefinition,
): string {
  const key = `${schemeId}|${category.name}`;
  let h = 0;
  for (let i = 0; i < key.length; i++) {
    h = (h * 31 + key.charCodeAt(i)) | 0;
  }
  return PALETTE[Math.abs(h) % PALETTE.length];
}

export function buildColorMap(
  scheme: CodingScheme | null,
  categories: CategoryDefinition[],
): Record<string, string> {
  if (!scheme) return {};
  const out: Record<string, string> = {};
  for (const cat of categories) {
    out[cat.name] = colorFor(scheme.id, cat);
  }
  return out;
}

export function codeFor(name: string): string {
  if (!name) return "—";
  const trimmed = name.trim();
  if (trimmed.length <= 3) return trimmed.toUpperCase();
  const afterColon = trimmed.includes(":")
    ? trimmed.split(":").pop()!.trim()
    : trimmed;
  const words = afterColon.split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase();
  }
  return afterColon.slice(0, 2).toUpperCase();
}

export function colorWithAlpha(hex: string, alpha: number): string {
  const a = Math.round(Math.max(0, Math.min(1, alpha)) * 255)
    .toString(16)
    .padStart(2, "0");
  return `${hex}${a}`;
}
