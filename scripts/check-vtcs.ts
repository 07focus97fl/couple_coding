/**
 * WHAT:    Keyless checks for the VTCS scheme: that the turn and utterance prompts
 *          stay in sync (they share one body and may differ only in the unit word,
 *          the one-code rule and the output format), that the rules taken from the
 *          lab coding sheet are actually present, that every category description
 *          still yields a title for the scheme editor, and that continuous and
 *          time-window runs still fall back to the generic prompt.
 *          Exits non-zero on the first failure.
 * STEP:    Development only. Run with `npx --yes tsx scripts/check-vtcs.ts`.
 * RUNS ON: node
 */
import assert from "node:assert/strict";
import { VTCS } from "@/lib/schemes/vtcs";
import { buildDefaultPrompt } from "@/lib/schemes/default-prompt";
import { buildSystemPrompt } from "@/lib/coding/build-messages";
import { DEFAULT_SCALE } from "@/lib/types";
import type { CodingMode, PromptOptions } from "@/lib/types";

const base = { outputType: "categorical", perSpeaker: true } as const;
const turnOpts: PromptOptions = { ...base, segmentation: "turn" };
const uttOpts: PromptOptions = { ...base, segmentation: "utterance" };

const turn = VTCS.defaultPrompt(turnOpts);
const utterance = VTCS.defaultPrompt(uttOpts);

/* ---- 1. Only categorical turn/utterance runs use the hand-written prompts ---- */

for (const opts of [
  { ...turnOpts, outputType: "continuous", scale: DEFAULT_SCALE },
  { ...uttOpts, outputType: "continuous", scale: DEFAULT_SCALE },
  { ...base, segmentation: "time" },
] as PromptOptions[]) {
  assert.equal(
    VTCS.defaultPrompt(opts),
    buildDefaultPrompt(opts),
    `${opts.outputType}/${opts.segmentation} must fall back to the generic default prompt`,
  );
}

/* ---- 2. The turn and utterance prompts have not drifted apart ---- */

/** The shared body: everything between the opener and the output format. */
function body(prompt: string): string[] {
  const start = prompt.indexOf("## CRITICAL RULES");
  const end = prompt.indexOf("## Output Format");
  assert.ok(start > 0 && end > start, "prompt is missing its rules or output section");
  return prompt.slice(start, end).trimEnd().split("\n");
}

/**
 * Erase the three sanctioned differences so the rest must match exactly: the unit
 * word, and the whole of critical rule 3 (which says something genuinely different
 * in each mode -- one code per turn vs. one code per statement).
 */
function canonical(lines: string[]): string[] {
  return lines.map((line) => {
    if (line.startsWith("3. One code per ")) return "3. <one-code rule>";
    return line
      .replace(/\bAn utterance\b|\bA turn\b/g, "<A>")
      .replace(/\ban utterance\b|\ba turn\b/g, "<a>")
      .replace(/\bevery utterance\b|\bevery turn\b/g, "<every>")
      .replace(/\bOne code per speaker turn\b|\bOne code per utterance\b/g, "<one>");
  });
}

assert.deepEqual(
  canonical(body(turn)),
  canonical(body(utterance)),
  "the turn and utterance prompt bodies have drifted apart",
);

/* ---- 3. The rules taken from the coding sheet are present in both prompts ---- */

const REQUIRED_IN_BOTH: [string, string][] = [
  ["question can be R", 'A question CAN be R'],
  ["goal of the statement", 'What is the goal of the statement?'],
  ["P/B/R override ID", "P, B and R override ID"],
  ["Mom Rule generalised", "applies to ALL of P, B, R and ID"],
  ["tone substitute", "You cannot hear tone"],
  ["off-topic NC", "not addressing the conversation topic"],
  ["ends off topic", "ENDS off topic"],
  ["topic drift", "topic drift"],
  ["R covers the idea", "reject their idea or point of view"],
  ["R survives prompting", "Still an R when asked or prompted"],
  ["we cannot escape R", 'Saying "we" does NOT get someone out of an R'],
  ["we escapes B", 'Saying "we" CAN get someone out of a Blame'],
  ["B cannot be time-stamped", "could be time-stamped"],
  ["B not if asked", "Not a blame if the partner asked"],
  ["P cannot be we", 'if it is framed as "we"'],
  ["P distributed equally", "responsibility is distributed equally"],
  ["MR needs inaccuracy", "the attribution is inaccurate"],
  ["MR not if asked", "cannot be MR if the partner asked"],
  ["DR present or future", "present- or future-focused excuse"],
  ["exaggeration step", "could not possibly be true"],
];

for (const [label, needle] of REQUIRED_IN_BOTH) {
  assert.ok(turn.includes(needle), `turn prompt is missing: ${label}`);
  assert.ok(utterance.includes(needle), `utterance prompt is missing: ${label}`);
}

// The decision tree runs 1..10 with P/B/R (3-5) ahead of the ID checks (6-9).
for (const prompt of [turn, utterance]) {
  for (const [step, code] of [
    [3, "**R**"],
    [4, "**B**"],
    [5, "**P**"],
    [6, "**ID**"],
    [9, "**ID**"],
  ] as [number, string][]) {
    const line = prompt
      .split("\n")
      .find((l) => l.startsWith(`${step}. Does it`) || l.startsWith(`${step}. Is it`));
    assert.ok(line, `decision tree step ${step} is missing`);
    assert.ok(line.includes(code), `decision tree step ${step} should resolve to ${code}`);
  }
  assert.ok(
    prompt.includes("10. Everything else, or when ambiguous → **IN**"),
    "the decision tree must still end by defaulting to IN",
  );
}

// Every ID subcategory must be defined in the ID category AND offered in the
// output format, so the model is never asked for a label it was not taught.
const SUBCATEGORIES = ["HQ", "SAR", "MR", "DR", "HJ", "EX"];
const idDescription = VTCS.categories.find((c) => c.name === "ID")?.description ?? "";
for (const sub of SUBCATEGORIES) {
  assert.ok(idDescription.includes(`${sub} (`), `the ID category does not define ${sub}`);
}
const subcategoryList = `${SUBCATEGORIES.slice(0, -1).join(", ")}, or ${SUBCATEGORIES.at(-1)}`;
for (const prompt of [turn, utterance]) {
  assert.ok(
    prompt.includes(`specify ${subcategoryList} if applicable`),
    "the output format must offer exactly the six ID subcategories",
  );
}

/* ---- 4. Category descriptions still drive the scheme editor and the prompt ---- */

assert.deepEqual(
  VTCS.categories.map((c) => c.name),
  ["IN", "NC", "ID", "P", "B", "R"],
  "VTCS must keep its six codes, in order",
);

/** Mirrors splitDefinition in app/coding/components/sections/SectionScheme.tsx. */
function titleOf(description: string): string {
  const m = description.trim().match(/^([^.!?]*[.!?])\s+([\s\S]*)$/);
  return m && m[2].trim() ? m[1].replace(/[.!?]+\s*$/, "").trim() : "";
}

const EXPECTED_TITLES: Record<string, string> = {
  IN: "Integrative",
  NC: "Non-Continuity",
  ID: "Indirect Distributive",
  P: "Prescription",
  B: "Blame",
  R: "Rejection",
};

for (const cat of VTCS.categories) {
  assert.equal(
    titleOf(cat.description),
    EXPECTED_TITLES[cat.name],
    `the scheme editor would show the wrong title for ${cat.name}`,
  );
}

// NC was renamed from Non-Constructive; nothing in the scheme may still say so.
for (const cat of VTCS.categories) {
  assert.ok(
    !cat.description.includes("Non-Constructive"),
    `${cat.name} still refers to Non-Constructive`,
  );
}

const mode: CodingMode = { segmentation: "turn", outputType: "categorical" };
const system = buildSystemPrompt(turn, VTCS.categories, mode);
for (const cat of VTCS.categories) {
  assert.ok(
    system.includes(`- "${cat.name}": ${cat.description}`),
    `the category block dropped ${cat.name}`,
  );
}
assert.ok(system.startsWith(turn), "the category block must be appended to the prompt");

console.log(
  `check-vtcs: OK (turn ${turn.length} chars, utterance ${utterance.length} chars, ` +
    `${VTCS.categories.length} categories)`,
);
