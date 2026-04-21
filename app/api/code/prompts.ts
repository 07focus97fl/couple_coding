import {
  PromptBlocks,
  PROMPT_BLOCK_ORDER,
  SpeakingTurn,
} from "@/lib/types";

export function buildSystemPrompt(blocks: PromptBlocks): string {
  return PROMPT_BLOCK_ORDER
    .map((key) => blocks[key])
    .map((v) => (typeof v === "string" ? v.trim() : ""))
    .filter((v) => v.length > 0)
    .join("\n\n");
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
