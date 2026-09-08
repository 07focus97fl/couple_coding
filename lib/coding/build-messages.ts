import {
  CategoryDefinition,
  CodingMode,
  PreSegment,
  DEFAULT_SCALE,
} from "@/lib/types";

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
    const scale = mode.scale ?? DEFAULT_SCALE;
    const anchors =
      scale.minLabel && scale.maxLabel
        ? ` where ${scale.min} = "${scale.minLabel}" and ${scale.max} = "${scale.maxLabel}"`
        : "";
    return (
      `${userPrompt.trim()}\n\n` +
      `Rate each of the following behaviors independently from ${scale.min} to ${scale.max}${anchors}. ` +
      `Every behavior must receive a rating, even if it is barely present.\n\n` +
      `Behaviors to rate:\n${block}`
    );
  }

  return `${userPrompt.trim()}\n\nCategories to choose from:\n${block}`;
}

function fmtTime(t: number): string {
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

function renderSegment(seg: PreSegment): string {
  if (seg.kind === "time") {
    return `[Window ${seg.index}] (${fmtTime(seg.startTime)}–${fmtTime(seg.endTime)})\n${seg.text}`;
  }
  return `[Turn ${seg.turnNumber}] ${seg.speaker}: ${seg.text}`;
}

export function buildUserMessage(
  beforeSegs: PreSegment[],
  target: PreSegment,
  afterSegs: PreSegment[],
  topic?: string,
): string {
  let message = "";

  if (topic && topic.trim().length > 0) {
    message += `CONVERSATION TOPIC: ${topic.trim()}\n\n`;
  }

  if (beforeSegs.length > 0) {
    message += "PRIOR CONTEXT:\n";
    for (const seg of beforeSegs) {
      message += `${renderSegment(seg)}\n`;
    }
    message += "\n";
  }

  const targetHeader = target.kind === "time" ? "WINDOW" : "TURN";
  message += `TARGET ${targetHeader} TO CODE:\n${renderSegment(target)}`;

  if (afterSegs.length > 0) {
    message += "\n\nFOLLOWING CONTEXT:\n";
    for (const seg of afterSegs) {
      message += `${renderSegment(seg)}\n`;
    }
  }

  return message;
}

/**
 * Batched variant: code several consecutive targets in one call. The shared
 * prior/following context is rendered once at each end (the targets serve as
 * each other's internal context), and each target is labelled with the
 * unit_index the model must echo back in its `units` entry. The targets are
 * consecutive pre-segments, so context only needs to wrap the whole group.
 */
export function buildBatchUserMessage(
  beforeSegs: PreSegment[],
  targets: PreSegment[],
  afterSegs: PreSegment[],
  topic?: string,
): string {
  let message = "";

  if (topic && topic.trim().length > 0) {
    message += `CONVERSATION TOPIC: ${topic.trim()}\n\n`;
  }

  if (beforeSegs.length > 0) {
    message += "PRIOR CONTEXT:\n";
    for (const seg of beforeSegs) {
      message += `${renderSegment(seg)}\n`;
    }
    message += "\n";
  }

  message +=
    'UNITS TO CODE — code each one independently. In "units", return exactly one entry per unit below, tagged with its unit_index:\n';
  targets.forEach((seg, i) => {
    message += `\n[unit_index ${i}] ${renderSegment(seg)}\n`;
  });

  if (afterSegs.length > 0) {
    message += "\nFOLLOWING CONTEXT:\n";
    for (const seg of afterSegs) {
      message += `${renderSegment(seg)}\n`;
    }
  }

  return message;
}
