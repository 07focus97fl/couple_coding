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
  roster?: string[],
): Anthropic.Tool {
  const categoryEnum = Array.from(
    new Set(categories.filter((c) => c.name.trim() !== "").map((c) => c.name)),
  );

  const leaf: Leaf =
    mode.outputType === "continuous"
      ? continuousLeaf(categoryEnum, mode.scale ?? DEFAULT_SCALE)
      : categoricalLeaf(categoryEnum);

  // The per-unit content — the shape used to code ONE pre-segment. These mirror
  // the historical top-level tool literals exactly, so a non-batched run
  // (batchSize <= 1) produces a byte-identical toolDefinition. Batching wraps an
  // array of these (below).
  let innerDescription: string;
  let innerProps: Record<string, unknown>;
  let innerRequired: string[];

  if (mode.segmentation === "time" && mode.perSpeaker) {
    // Per-speaker time coding: one entry per speaker who spoke in the window,
    // each carrying the same leaf payload (category or ratings), wrapped in a
    // `speakers` array — mirroring how the utterance branch wraps the leaf.
    const speakerProp: Record<string, unknown> =
      roster && roster.length > 0
        ? { type: "string", enum: roster, description: "Speaker id this entry codes." }
        : { type: "string", description: "Speaker id this entry codes." };
    innerDescription =
      "Code each speaker who speaks in the target time window. Return one entry per speaking speaker; consider the whole window for context, but code each speaker's own behavior.";
    innerProps = {
      speakers: {
        type: "array",
        minItems: 1,
        items: {
          type: "object",
          properties: {
            speaker: speakerProp,
            ...leaf.properties,
          },
          required: ["speaker", ...leaf.required],
        },
      },
    };
    innerRequired = ["speakers"];
  } else if (mode.segmentation === "utterance") {
    innerDescription =
      "Segment a speaking turn into one or more coded utterances. Each utterance must quote a verbatim contiguous substring of the target turn.";
    innerProps = {
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
    };
    innerRequired = ["utterances"];
  } else {
    innerDescription =
      mode.outputType === "continuous"
        ? "Rate a unit on each behavioral dimension and provide a rationale."
        : "Categorize a speaking turn and provide a rationale.";
    innerProps = leaf.properties;
    innerRequired = leaf.required;
  }

  // Non-batched: today's exact tool shape (byte-identical literals).
  if ((mode.batchSize ?? 1) <= 1) {
    return {
      name: TOOL_NAME,
      description: innerDescription,
      input_schema: {
        type: "object" as const,
        properties: innerProps,
        required: innerRequired,
      },
    };
  }

  // Batched: an array of per-unit entries, each tagged with the unit_index it
  // codes — matching the [unit_index N] labels in the user message — so results
  // stay attributable to their source segment even if the model reorders or
  // drops one. The per-unit shape (innerProps) is unchanged from above.
  return {
    name: TOOL_NAME,
    description: `Code each numbered target unit independently. Return one entry per unit in "units", tagged with its unit_index as shown in [unit_index N]. ${innerDescription}`,
    input_schema: {
      type: "object" as const,
      properties: {
        units: {
          type: "array",
          minItems: 1,
          items: {
            type: "object",
            properties: {
              unit_index: {
                type: "integer",
                minimum: 0,
                description:
                  "Index of the target unit this entry codes, as shown in [unit_index N] in the message.",
              },
              ...innerProps,
            },
            required: ["unit_index", ...innerRequired],
          },
        },
      },
      required: ["units"],
    },
  };
}

/** Hard cap on output tokens per call, so a large batch can't request an
 *  unbounded budget. Comfortably above any single batch's real need. */
const MAX_OUTPUT_CEILING = 16000;

/**
 * Token budget per call. Categorical: 300 whole-unit, 2000 for an utterances
 * array (matching prior behavior). Continuous scales with the dimension count.
 * When `units` > 1 (batching), the per-unit budget is multiplied by the number
 * of units in the batch (plus a little wrapper headroom) and clamped to a
 * ceiling. `units` = 1 returns exactly the original per-unit value.
 */
export function computeMaxTokens(
  mode: CodingMode,
  dimCount: number,
  rosterSize = 2,
  units = 1,
): number {
  const base =
    mode.outputType === "continuous" ? Math.max(600, 40 * dimCount) : 300;
  const perUnit =
    mode.segmentation === "time" && mode.perSpeaker
      ? // One leaf per roster speaker, plus headroom for the array wrapper.
        base * Math.max(1, rosterSize) + 200
      : mode.segmentation === "utterance"
        ? base + 1700
        : base;
  if (units <= 1) return perUnit;
  return Math.min(perUnit * units + 200, MAX_OUTPUT_CEILING);
}
