import Anthropic from "@anthropic-ai/sdk";
import { CategoryDefinition, CodingMode, RatingScale, DEFAULT_SCALE } from "./types";

export const TOOL_NAME = "code_exchange";

interface Leaf {
  properties: Record<string, unknown>;
  required: string[];
}

/** The per-unit categorical payload (one code + rationale, optional refinements). */
function categoricalLeaf(categoryEnum: string[]): Leaf {
  return {
    properties: {
      category: { type: "string", enum: categoryEnum },
      rationale: { type: "string" },
      subcategory: {
        type: ["string", "null"],
        description:
          "Optional. When the scheme defines subcategories for a code (e.g., HQ/MR/DR/HJ for ID), specify which one applies. Null otherwise.",
      },
      alternatives_considered: {
        type: "array",
        items: { type: "string" },
        description: "Optional. Codes that were close but not chosen.",
      },
    },
    required: ["category", "rationale"],
  };
}

/** The per-unit continuous payload: one numeric rating per behavioral dimension. */
function continuousLeaf(dimNames: string[], scale: RatingScale): Leaf {
  const ratingProps: Record<string, unknown> = {};
  for (const name of dimNames) {
    ratingProps[name] = {
      type: "number",
      minimum: scale.min,
      maximum: scale.max,
      description: `Rating for "${name}" from ${scale.min} to ${scale.max}.`,
    };
  }
  return {
    properties: {
      ratings: {
        type: "object",
        properties: ratingProps,
        required: dimNames, // every dimension must be rated
        additionalProperties: false,
      },
      rationale: { type: "string" },
    },
    required: ["ratings", "rationale"],
  };
}

/**
 * Build the forced `code_exchange` tool for a coding run. Branches on the two
 * axes: outputType (what the leaf payload is) and segmentation (whether the unit
 * is coded whole, or sub-segmented into an utterances array).
 *
 * The categorical leaf reproduces the historical tool literals exactly so the
 * logged toolDefinition is byte-identical for turn and utterance runs.
 */
export function buildCodingTool(
  mode: CodingMode,
  categories: CategoryDefinition[],
): Anthropic.Tool {
  const categoryEnum = Array.from(
    new Set(categories.filter((c) => c.name.trim() !== "").map((c) => c.name)),
  );

  const leaf: Leaf =
    mode.outputType === "continuous"
      ? continuousLeaf(categoryEnum, mode.scale ?? DEFAULT_SCALE)
      : categoricalLeaf(categoryEnum);

  const isMulti = mode.segmentation === "utterance";
  if (!isMulti) {
    return {
      name: TOOL_NAME,
      description:
        mode.outputType === "continuous"
          ? "Rate a unit on each behavioral dimension and provide a rationale."
          : "Categorize a speaking turn and provide a rationale.",
      input_schema: {
        type: "object" as const,
        properties: leaf.properties,
        required: leaf.required,
      },
    };
  }

  return {
    name: TOOL_NAME,
    description:
      "Segment a speaking turn into one or more coded utterances. Each utterance must quote a verbatim contiguous substring of the target turn.",
    input_schema: {
      type: "object" as const,
      properties: {
        utterances: {
          type: "array",
          minItems: 1,
          items: {
            type: "object",
            properties: {
              text: {
                type: "string",
                description: "Verbatim contiguous substring of the target turn.",
              },
              ...leaf.properties,
            },
            required: ["text", ...leaf.required],
          },
        },
      },
      required: ["utterances"],
    },
  };
}

/**
 * Token budget per unit. Categorical: 300 whole-unit, 2000 for an utterances
 * array (matching prior behavior). Continuous scales with the dimension count.
 */
export function computeMaxTokens(mode: CodingMode, dimCount: number): number {
  const base =
    mode.outputType === "continuous" ? Math.max(600, 40 * dimCount) : 300;
  return mode.segmentation === "utterance" ? base + 1700 : base;
}
