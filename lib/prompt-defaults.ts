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

// ── Continuous (rating) wording. The specific scale + anchors are appended
// separately by buildSystemPrompt, so these stay scale-agnostic. ──
const CONTINUOUS_TURN_TASK =
  "Your task is to rate a single speaking turn from a couple's conversation on each of the behavioral dimensions provided. Rate every dimension independently on the provided scale — the dimensions are not mutually exclusive, so a turn can be high on several at once.";

const CONTINUOUS_UTTERANCE_TASK = [
  "Your task is to segment a single speaking turn into one or more **utterances** — contiguous stretches of speech that each represent a single coherent behavioral act — and rate each utterance on every behavioral dimension provided.",
  "",
  "Rate every dimension independently on the provided scale. Return utterances in the order they appear in the turn. Each utterance's `text` field MUST be a verbatim contiguous substring of the target turn — copy it exactly.",
].join("\n");

const CONTINUOUS_TIME_TASK =
  "Your task is to rate a fixed-duration time window from a couple's conversation on each of the behavioral dimensions provided. A window may contain speech from both partners, labeled by speaker. Rate every dimension independently on the provided scale, considering the window as a whole.";

const CONTINUOUS_TURN_OUTPUT =
  "You MUST use the code_exchange tool to provide a numeric rating for every dimension and a brief rationale (1-2 sentences).";

const CONTINUOUS_UTTERANCE_OUTPUT =
  "You MUST use the code_exchange tool to provide an array of utterances. For each utterance, return its verbatim `text`, a numeric rating for every dimension, and a brief `rationale` (1-2 sentences).";

// ── Time-window (categorical) wording. ──
const TIME_TASK =
  "Your task is to categorize a fixed-duration time window from a couple's conversation into exactly one of the categories provided. A window may contain speech from both partners, labeled by speaker — code the window as a whole.";

const TIME_CONTEXT =
  "You will be given some prior windows for context, followed by the target window to code. Focus on the target window only — use the context windows to understand conversational dynamics, but only code the target window.";

export function buildDefaultPrompt(
  opts: PromptOptions,
  schemeRules?: string,
): string {
  const isContinuous = opts.outputType === "continuous";

  let task: string;
  let context: string;
  let output: string;

  if (opts.segmentation === "time") {
    task = isContinuous ? CONTINUOUS_TIME_TASK : TIME_TASK;
    context = TIME_CONTEXT;
    output = isContinuous ? CONTINUOUS_TURN_OUTPUT : TURN_OUTPUT;
  } else if (opts.segmentation === "utterance") {
    task = isContinuous ? CONTINUOUS_UTTERANCE_TASK : UTTERANCE_TASK;
    context = UTTERANCE_CONTEXT;
    output = isContinuous ? CONTINUOUS_UTTERANCE_OUTPUT : UTTERANCE_OUTPUT;
  } else {
    task = isContinuous ? CONTINUOUS_TURN_TASK : TURN_TASK;
    context = TURN_CONTEXT;
    output = isContinuous ? CONTINUOUS_TURN_OUTPUT : TURN_OUTPUT;
  }

  const parts = [ROLE, task, context];
  if (schemeRules && schemeRules.trim().length > 0) {
    parts.push(schemeRules.trim());
  }
  parts.push(output);

  return parts.join("\n\n");
}
