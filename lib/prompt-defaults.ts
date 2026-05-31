import { PromptOptions } from "./types";

const ROLE =
  "You are an expert behavioral coder for couple conversation research.";

const TURN_TASK =
  "Your task is to categorize a single speaking turn from a couple's conversation into exactly one of the categories provided.";

const UTTERANCE_TASK = [
  "Your task is to segment a single speaking turn into one or more **utterances** — contiguous stretches of speech that each represent a single coherent behavioral act relative to the categories provided — and assign exactly one category to each utterance.",
  "",
  "A speaking turn may contain multiple utterances when the speaker shifts behavioral intent mid-turn (e.g., a blame followed by a concession, or a prescription followed by a criticism). Conversely, a long turn that sustains one behavioral intent is a single utterance. Use the categories themselves — not grammatical sentence boundaries — to decide where one utterance ends and the next begins.",
  "",
  "Return utterances in the order they appear in the turn. Each utterance's `text` field MUST be a verbatim contiguous substring of the target turn — copy it exactly, preserving punctuation, capitalization, and spacing.",
].join("\n");

const TURN_CONTEXT =
  "You will be given some prior turns for context, followed by the target turn to code. Focus on the target turn only — use context turns to understand conversational dynamics, but only code the target turn.";

const UTTERANCE_CONTEXT =
  "You will be given some prior turns for context, followed by the target turn to segment and code. Focus on the target turn only — do not segment or code the context turns. Use the context turns only to understand conversational dynamics.";

const TURN_OUTPUT =
  "You MUST use the code_exchange tool to provide your categorization and a brief rationale (1-2 sentences) explaining why you chose that category.";

const UTTERANCE_OUTPUT =
  "You MUST use the code_exchange tool to provide an array of utterances. For each utterance, return its verbatim `text`, its `category`, and a brief `rationale` (1-2 sentences). Return at least one utterance even if the entire turn is a single behavioral act.";

export function buildDefaultPrompt(
  opts: PromptOptions,
  schemeRules?: string,
): string {
  if (opts.outputType === "continuous") {
    // Reserved extension point — the continuous-ratings slice authors the
    // "rate each behavior on the scale" task/output strings here.
    throw new Error("continuous output type is not yet implemented");
  }
  if (opts.segmentation === "time") {
    // Reserved extension point — the time-segmentation slice authors the
    // window task/context strings here.
    throw new Error("time segmentation is not yet implemented");
  }

  const isTurn = opts.segmentation === "turn";
  const task = isTurn ? TURN_TASK : UTTERANCE_TASK;
  const context = isTurn ? TURN_CONTEXT : UTTERANCE_CONTEXT;
  const output = isTurn ? TURN_OUTPUT : UTTERANCE_OUTPUT;

  const parts = [ROLE, task, context];
  if (schemeRules && schemeRules.trim().length > 0) {
    parts.push(schemeRules.trim());
  }
  parts.push(output);

  return parts.join("\n\n");
}
