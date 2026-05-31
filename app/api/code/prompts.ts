import { CategoryDefinition, CodingMode, PreSegment } from "@/lib/types";

export function buildSystemPrompt(
  userPrompt: string,
  categories: CategoryDefinition[],
  mode: CodingMode,
): string {
  const block = categories
    .filter((c) => c.name.trim() !== "")
    .map((c) => `- "${c.name}": ${c.description}`)
    .join("\n");

  if (mode.outputType === "continuous") {
    // Reserved extension point — the continuous-ratings slice appends a
    // "rate each behavior on the <scale>" block instead of a category list.
    throw new Error("continuous output type is not yet implemented");
  }

  return `${userPrompt.trim()}\n\nCategories to choose from:\n${block}`;
}

function renderSegment(seg: PreSegment): string {
  if (seg.kind === "time") {
    // Reserved: the time slice renders speaker-labeled multi-speaker windows.
    return `[Window ${seg.index}]\n${seg.text}`;
  }
  return `[Turn ${seg.turnNumber}] ${seg.speaker}: ${seg.text}`;
}

export function buildUserMessage(
  contextSegs: PreSegment[],
  target: PreSegment,
  topic?: string,
): string {
  let message = "";

  if (topic && topic.trim().length > 0) {
    message += `CONVERSATION TOPIC: ${topic.trim()}\n\n`;
  }

  if (contextSegs.length > 0) {
    message += "PRIOR CONTEXT:\n";
    for (const seg of contextSegs) {
      message += `${renderSegment(seg)}\n`;
    }
    message += "\n";
  }

  const targetHeader = target.kind === "time" ? "WINDOW" : "TURN";
  message += `TARGET ${targetHeader} TO CODE:\n${renderSegment(target)}`;

  return message;
}
