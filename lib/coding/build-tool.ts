/**
 * WHAT:    Builds the JSON schema of the forced "code_exchange" tool the model must
 *          call and the output-token budget for a call. Every call answers in the
 *          same shape, `{ units: [{ unit_index, ...payload }] }`, whether it codes
 *          one unit or a batch; the payload depends on output type, segmentation
 *          and per-speaker. Categorical turn and utterance runs use the field
 *          descriptions written for VTCS coding prompt v2, plus the tone-only
 *          ambiguity / other_reading / confidence fields [CR7] when tone
 *          assessment is on.
 * STEP:    Run, server side. Called by lib/coding/code-segments.ts.
 * RUNS ON: server only (imports the Anthropic SDK for a type)
 */
import Anthropic from "@anthropic-ai/sdk";
import { CategoryDefinition, CodingMode, RatingScale, DEFAULT_SCALE } from "@/lib/types";

export const TOOL_NAME = "code_exchange";

interface Leaf {
  properties: Record<string, unknown>;
  required: string[];
}

// ── VTCS v2 wording ──────────────────────────────────────────────────────────
// These descriptions cite the labels of VTCS coding prompt v2 ([D2.6], [CR4]).
// They apply to every categorical turn/utterance run, whatever the scheme,
// because VTCS is the only real scheme today. When other schemes arrive, they
// should supply their own wording here instead.

type V2Unit = "turn" | "utterance";

const V2_TOOL_DESCRIPTION: Record<V2Unit, string> = {
  turn:
    'Code each numbered target unit independently, following the coding prompt. Return one entry per unit in "units", tagged with its unit_index as shown in [unit_index N]. Each target unit is one speaking turn and may begin with a timestamp showing the elapsed time since the conversation started (e.g., [00:12]); use it to apply the first-15-seconds rule for NC [D2.6]. Categorize each speaking turn and provide a rationale.',
  utterance:
    'Code each numbered target unit independently, following the coding prompt. Return one entry per unit in "units", tagged with its unit_index as shown in [unit_index N]. Each target unit is one speaking turn and may begin with a timestamp showing the elapsed time since the conversation started (e.g., [00:12]); use it to apply the first-15-seconds rule for NC [D2.6]. Segment each speaking turn into one or more coded utterances, each quoting a verbatim contiguous substring of the turn, and give each utterance a code and a rationale.',
};

const TONE_REQUIRED = ["ambiguity", "other_reading", "confidence"];

/**
 * The tone-only fields of VTCS [CR7], asked for only when tone assessment is on
 * (CodingMode.toneAssessment). They come after the code and its refinements, so
 * the model writes the code first.
 */
function toneProperties(coded: string, categoryEnum: string[]): Record<string, unknown> {
  return {
    ambiguity: {
      type: "string",
      description: `One or two sentences on how the tone it was said in (warm or dismissive, sincere or sarcastic, playful or contemptuous) could change the code of this ${coded} [CR7(b)]. Tone only: other doubts belong in alternatives_considered. "None." if no tone would change the code.`,
    },
    other_reading: {
      type: ["string", "null"],
      enum: [...categoryEnum, null],
      description:
        "The code a different tone would most plausibly lead to [CR7(c)]. Null if no tone would change the code.",
    },
    confidence: {
      type: "number",
      minimum: 0,
      maximum: 1,
      description:
        "From 0 to 1, how well the code can be determined without hearing the tone [CR7(d)]. A low score does not mean another code is more likely; it means the tone would decide and a human should listen and review it.",
    },
  };
}

function v2CategoricalLeaf(categoryEnum: string[], unit: V2Unit, tone: boolean): Leaf {
  const coded = unit === "turn" ? "speaking turn" : "utterance";
  const ncRule =
    unit === "turn"
      ? "Do not assign NC to a speaking turn whose timestamp is earlier than 00:15 [D2.6]."
      : "Do not assign NC to an utterance of a speaking turn whose timestamp is earlier than 00:15 [D2.6].";
  return {
    properties: {
      category: {
        type: "string",
        enum: categoryEnum,
        description: `The code for this ${coded}, as defined in the coding prompt [D1-D6] and chosen under the precedence rules [CR4]. ${ncRule}`,
      },
      rationale: {
        type: "string",
        description:
          "One to three sentences that walk through how you reached the code, citing the bracketed label of each prompt part at the point where you rely on it. Example: 'Given that the speaking turn is on topic [CR2(a)] and blames the partner's behavior in general terms [D4.1, D4.2], and since the exaggeration blames behavior rather than undermining an idea [D6.5], the correct code is B, with ID (EX) as an alternative [CR4(b)].' Do not simply list labels at the end.",
      },
      subcategory: {
        type: ["string", "null"],
        description:
          "Optional. When category is ID, the ID subcategory that applies, using the labels the prompt gives (HQ, HJ, MR, DR, EX) [D6.1-D6.5]. If more than one applies, follow CR4(e). Null otherwise.",
      },
      alternatives_considered: {
        type: "array",
        items: { type: "string" },
        description:
          "Codes that were close but not chosen, including IN, NC or an ID subcategory set aside under the precedence rules [CR4]. Empty array if none.",
      },
      ...(tone ? toneProperties(coded, categoryEnum) : {}),
    },
    required: ["category", "rationale", ...(tone ? TONE_REQUIRED : [])],
  };
}

// ── Generic wording (continuous output, time windows) ────────────────────────

/** The per-unit categorical payload (one code + rationale, optional refinements). */
function categoricalLeaf(categoryEnum: string[]): Leaf {
  return {
    properties: {
      category: { type: "string", enum: categoryEnum },
      rationale: { type: "string" },
      subcategory: {
        type: ["string", "null"],
        description:
          "Optional. When the scheme defines subcategories for a code, specify which one applies, using the labels the prompt gives. Null otherwise.",
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
 * Build the forced `code_exchange` tool for a coding run. The outer shape is
 * always a `units` array whose entries carry the `unit_index` the user message
 * shows as [unit_index N], so one unit and a batch are answered the same way.
 * Inside each entry: the leaf payload (category or ratings) coded whole, or
 * wrapped in an `utterances` or per-speaker `speakers` array.
 */
export function buildCodingTool(
  mode: CodingMode,
  categories: CategoryDefinition[],
  roster?: string[],
): Anthropic.Tool {
  const categoryEnum = Array.from(
    new Set(categories.filter((c) => c.name.trim() !== "").map((c) => c.name)),
  );

  // Categorical turn and utterance runs use the VTCS v2 wording.
  const v2Unit: V2Unit | null =
    mode.outputType === "categorical" && mode.segmentation !== "time"
      ? mode.segmentation === "utterance"
        ? "utterance"
        : "turn"
      : null;

  const leaf: Leaf =
    mode.outputType === "continuous"
      ? continuousLeaf(categoryEnum, mode.scale ?? DEFAULT_SCALE)
      : v2Unit
        ? v2CategoricalLeaf(categoryEnum, v2Unit, !!mode.toneAssessment)
        : categoricalLeaf(categoryEnum);

  // The content of one units[] entry, besides its unit_index.
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

  const description = v2Unit
    ? V2_TOOL_DESCRIPTION[v2Unit]
    : `Code each numbered target unit independently. Return one entry per unit in "units", tagged with its unit_index as shown in [unit_index N]. ${innerDescription}`;

  return {
    name: TOOL_NAME,
    description,
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

/**
 * Hard cap on output tokens per call, so a large batch can't request an
 * unbounded budget. Comfortably above any real batch's need (the largest is
 * about 12k: three utterance units). Kept below ~21k because the Anthropic SDK
 * refuses a non-streaming request whose max_tokens implies more than ten
 * minutes of generation.
 */
const MAX_OUTPUT_CEILING = 16000;

/**
 * Token budget per call. It is a cap, not a charge: only the tokens the model
 * writes are billed. Categorical: 1000 for a whole unit (room for a rationale
 * that cites prompt labels), plus 3000 for an utterances array. Continuous
 * scales with the dimension count. For a batch the per-unit budget is
 * multiplied by the number of units (plus a little wrapper headroom) and
 * clamped to the ceiling.
 */
export function computeMaxTokens(
  mode: CodingMode,
  dimCount: number,
  rosterSize = 2,
  units = 1,
): number {
  const base =
    mode.outputType === "continuous" ? Math.max(600, 40 * dimCount) : 1000;
  const perUnit =
    mode.segmentation === "time" && mode.perSpeaker
      ? // One leaf per roster speaker, plus headroom for the array wrapper.
        base * Math.max(1, rosterSize) + 200
      : mode.segmentation === "utterance"
        ? base + 3000
        : base;
  if (units <= 1) return perUnit;
  return Math.min(perUnit * units + 200, MAX_OUTPUT_CEILING);
}
