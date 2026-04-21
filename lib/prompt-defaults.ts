import {
  CategoryDefinition,
  CodingScheme,
  Granularity,
  PromptBlocks,
} from "./types";

export function defaultRole(): string {
  return "You are an expert behavioral coder for couple conversation research.";
}

export function defaultGranularity(granularity: Granularity): string {
  if (granularity === "turn") {
    return "Your task is to categorize a single speaking turn from a couple's conversation into exactly one of the following categories:";
  }
  return [
    "Your task is to segment a single speaking turn into one or more **utterances** — contiguous stretches of speech that each represent a single coherent behavioral act relative to the categories below — and assign exactly one category to each utterance.",
    "",
    "A speaking turn may contain multiple utterances when the speaker shifts behavioral intent mid-turn (e.g., a blame followed by a concession, or a prescription followed by a criticism). Conversely, a long turn that sustains one behavioral intent is a single utterance. Use the categories themselves — not grammatical sentence boundaries — to decide where one utterance ends and the next begins.",
    "",
    "Return utterances in the order they appear in the turn. Each utterance's `text` field MUST be a verbatim contiguous substring of the target turn — copy it exactly, preserving punctuation, capitalization, and spacing. The categories to choose from:",
  ].join("\n");
}

export function defaultCategories(categories: CategoryDefinition[]): string {
  return categories
    .filter((c) => c.name.trim() !== "")
    .map((c) => `- "${c.name}": ${c.description}`)
    .join("\n");
}

export function defaultRules(scheme: CodingScheme): string {
  return scheme.rules ?? "";
}

export function defaultContextFraming(granularity: Granularity): string {
  if (granularity === "turn") {
    return "You will be given some prior turns for context, followed by the target turn to code. Focus on the target turn only — use context turns to understand conversational dynamics, but only code the target turn.";
  }
  return "You will be given some prior turns for context, followed by the target turn to segment and code. Focus on the target turn only — do not segment or code the context turns. Use the context turns only to understand conversational dynamics.";
}

export function defaultOutputInstruction(granularity: Granularity): string {
  if (granularity === "turn") {
    return "You MUST use the code_exchange tool to provide your categorization and a brief rationale (1-2 sentences) explaining why you chose that category.";
  }
  return "You MUST use the code_exchange tool to provide an array of utterances. For each utterance, return its verbatim `text`, its `category`, and a brief `rationale` (1-2 sentences). Return at least one utterance even if the entire turn is a single behavioral act.";
}

export function buildDefaultBlocks(
  scheme: CodingScheme,
  granularity: Granularity
): PromptBlocks {
  return {
    role: defaultRole(),
    granularity: defaultGranularity(granularity),
    categories: defaultCategories(scheme.categories),
    rules: defaultRules(scheme),
    contextFraming: defaultContextFraming(granularity),
    outputInstruction: defaultOutputInstruction(granularity),
  };
}
