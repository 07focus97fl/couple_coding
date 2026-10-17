/**
 * WHAT:    Builds the two strings each LLM call receives: the final system prompt
 *          (the user's prompt with the category or rating definitions spliced in
 *          at {{CATEGORIES}}, or appended when the prompt has no marker) and the
 *          user message (prior context, the target units tagged [unit_index N],
 *          following context, and the topic). Timed turns carry an elapsed-time
 *          stamp such as [00:12].
 * STEP:    Run, server side. Called by lib/coding/code-segments.ts.
 * RUNS ON: server only (pure functions)
 */
import {
  CATEGORIES_PLACEHOLDER,
  CategoryDefinition,
  CodingMode,
  PreSegment,
  DEFAULT_SCALE,
} from "@/lib/types";

/**
 * The definitions as spliced in at the marker: each description verbatim (it
 * carries its own heading, e.g. "[D1] Integrative (IN) — the default."), one
 * blank line apart. A description that never mentions its code gets the code
 * prefixed so the model can still tell which definition belongs to which code.
 */
function splicedBlock(categories: CategoryDefinition[]): string {
  return categories
    .map((c) => {
      const desc = c.description.trim();
      return desc.includes(c.name) ? desc : `${c.name}: ${desc}`;
    })
    .join("\n\n");
}

export function buildSystemPrompt(
  userPrompt: string,
  categories: CategoryDefinition[],
  mode: CodingMode,
): string {
  const named = categories.filter((c) => c.name.trim() !== "");
  const prompt = userPrompt.trim();
  const hasMarker = prompt.includes(CATEGORIES_PLACEHOLDER);
  // split/join rather than replace(): descriptions may contain "$" sequences.
  const withDefinitions = hasMarker
    ? prompt.split(CATEGORIES_PLACEHOLDER).join(splicedBlock(named))
    : prompt;
  const block = named.map((c) => `- "${c.name}": ${c.description}`).join("\n");

  if (mode.outputType === "continuous") {
    const scale = mode.scale ?? DEFAULT_SCALE;
    const anchors =
      scale.minLabel && scale.maxLabel
        ? ` where ${scale.min} = "${scale.minLabel}" and ${scale.max} = "${scale.maxLabel}"`
        : "";
    const scaleLine =
      `Rate each of the following behaviors independently from ${scale.min} to ${scale.max}${anchors}. ` +
      `Every behavior must receive a rating, even if it is barely present.`;
    return hasMarker
      ? `${withDefinitions}\n\n${scaleLine}`
      : `${prompt}\n\n${scaleLine}\n\nBehaviors to rate:\n${block}`;
  }

  return hasMarker
    ? withDefinitions
    : `${prompt}\n\nCategories to choose from:\n${block}`;
}

function fmtTime(t: number): string {
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** Elapsed time as zero-padded mm:ss, e.g. 12.4 -> "00:12", 75 -> "01:15". */
function fmtStamp(t: number): string {
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/**
 * A turn without real timing (a CSV row today) has start and end at 0; it gets
 * no stamp, so the model does not read every such turn as "[00:00]".
 */
function isTimed(seg: PreSegment): boolean {
  return seg.startTime > 0 || seg.endTime > 0;
}

function renderSegment(seg: PreSegment): string {
  if (seg.kind === "time") {
    return `[Window ${seg.index}] (${fmtTime(seg.startTime)}–${fmtTime(seg.endTime)})\n${seg.text}`;
  }
  const stamp = isTimed(seg) ? `[${fmtStamp(seg.startTime)}] ` : "";
  return `${stamp}[Turn ${seg.turnNumber}] ${seg.speaker}: ${seg.text}`;
}

/**
 * The user message for one call: one or more consecutive targets. The shared
 * prior/following context is rendered once at each end (the targets serve as
 * each other's internal context), and each target is labelled with the
 * unit_index the model must echo back in its `units` entry. The targets are
 * consecutive pre-segments, so context only needs to wrap the whole group.
 */
export function buildUserMessage(
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
