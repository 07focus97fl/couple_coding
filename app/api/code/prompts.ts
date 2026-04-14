import { CodingScheme, SpeakingTurn } from "@/lib/types";

export function buildSystemPrompt(scheme: CodingScheme): string {
  const categoryList = scheme.categories
    .map((c) => `- "${c.name}": ${c.description}`)
    .join("\n");

  let prompt = `You are an expert behavioral coder for couple conversation research. Your task is to categorize a single speaking turn from a couple's conversation into one of the following categories:

${categoryList}`;

  if (scheme.rules) {
    prompt += `\n\n${scheme.rules}`;
  }

  prompt += `\n\nYou will be given some prior turns for context, followed by the target turn to code. Focus on the target turn only. Use the context turns to understand the conversational dynamics but only code the target turn.

You MUST use the code_exchange tool to provide your categorization and a brief rationale (1-2 sentences) explaining why you chose that category.`;

  return prompt;
}

export function buildUserMessage(
  contextTurns: SpeakingTurn[],
  targetTurn: SpeakingTurn
): string {
  let message = "";

  if (contextTurns.length > 0) {
    message += "PRIOR CONTEXT:\n";
    for (const t of contextTurns) {
      message += `[Turn ${t.turnNumber}] ${t.speaker}: ${t.text}\n`;
    }
    message += "\n";
  }

  message += `TARGET TURN TO CODE:\n[Turn ${targetTurn.turnNumber}] ${targetTurn.speaker}: ${targetTurn.text}`;

  return message;
}
