import { CategoryDefinition, SpeakingTurn } from "@/lib/types";

export function buildSystemPrompt(
  userPrompt: string,
  categories: CategoryDefinition[],
): string {
  const block = categories
    .filter((c) => c.name.trim() !== "")
    .map((c) => `- "${c.name}": ${c.description}`)
    .join("\n");
  return `${userPrompt.trim()}\n\nCategories to choose from:\n${block}`;
}

export function buildUserMessage(
  contextTurns: SpeakingTurn[],
  targetTurn: SpeakingTurn,
  topic?: string,
): string {
  let message = "";

  if (topic && topic.trim().length > 0) {
    message += `CONVERSATION TOPIC: ${topic.trim()}\n\n`;
  }

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
