import Anthropic from "@anthropic-ai/sdk";
import { CategoryDefinition, CodingMode } from "./types";

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

  let leaf: Leaf;
  if (mode.outputType === "continuous") {
    // Reserved extension point. The continuous-ratings slice fills this in with a
    // `ratings` object of named numeric properties (every dimension required), e.g.
    //   ratings: { type: "object", properties: { <dim>: { type: "number", minimum, maximum } },
    //              required: categoryEnum, additionalProperties: false }
    throw new Error("continuous output type is not yet implemented");
  } else {
    leaf = categoricalLeaf(categoryEnum);
  }

  const isMulti = mode.segmentation === "utterance";
  if (!isMulti) {
    return {
      name: TOOL_NAME,
      description: "Categorize a speaking turn and provide a rationale.",
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
