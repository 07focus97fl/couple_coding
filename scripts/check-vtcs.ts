/**
 * WHAT:    Keyless checks for VTCS coding prompt v2: that the prompt field plus the
 *          six category boxes assemble into exactly the v2 text the owner wrote
 *          (scripts/fixtures/vtcs-v2-turn-prompt.txt), that the tool matches the
 *          owner's tool definition (scripts/fixtures/vtcs-v2-tool.json), that every
 *          label the prompt or tool cites is defined in both turn and utterance
 *          mode, that the scheme editor still finds a title for every category,
 *          that turns are stamped [mm:ss] only when they have timings, that
 *          prompts without {{CATEGORIES}} keep the old end-append, and that tone
 *          assessment [CR7] is absent when off (the fixtures are the tone-off
 *          baseline), comes after the code when on, and is parsed leniently.
 *          Exits non-zero on the first failure.
 * STEP:    Development only. Run with `npx --yes tsx scripts/check-vtcs.ts`.
 * RUNS ON: node
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { VTCS, vtcsCategories, vtcsPrompt } from "@/lib/schemes/vtcs";
import { buildDefaultPrompt } from "@/lib/schemes/default-prompt";
import { buildSystemPrompt, buildUserMessage } from "@/lib/coding/build-messages";
import { buildCodingTool } from "@/lib/coding/build-tool";
import { buildParseContext, parseUnitEntry } from "@/lib/coding/parse-response";
import { CATEGORIES_PLACEHOLDER, DEFAULT_SCALE } from "@/lib/types";
import type { CodingMode, PreSegment, PromptOptions } from "@/lib/types";

const fixture = (name: string) =>
  readFileSync(join(__dirname, "fixtures", name), "utf8");

const base = { outputType: "categorical", perSpeaker: true } as const;
const turnOpts: PromptOptions = { ...base, segmentation: "turn" };
const uttOpts: PromptOptions = { ...base, segmentation: "utterance" };
const turnMode: CodingMode = { segmentation: "turn", outputType: "categorical", batchSize: 1 };
const uttMode: CodingMode = { segmentation: "utterance", outputType: "categorical", batchSize: 1 };

const turnSystem = buildSystemPrompt(
  VTCS.defaultPrompt(turnOpts),
  VTCS.categoriesFor!(turnOpts),
  turnMode,
);
const uttSystem = buildSystemPrompt(
  VTCS.defaultPrompt(uttOpts),
  VTCS.categoriesFor!(uttOpts),
  uttMode,
);

// The same with tone assessment on (prompt section [CR7] and the tone fields).
const turnToneOpts: PromptOptions = { ...turnOpts, toneAssessment: true };
const uttToneOpts: PromptOptions = { ...uttOpts, toneAssessment: true };
const turnToneMode: CodingMode = { ...turnMode, toneAssessment: true };
const uttToneMode: CodingMode = { ...uttMode, toneAssessment: true };
const turnToneSystem = buildSystemPrompt(
  VTCS.defaultPrompt(turnToneOpts),
  VTCS.categoriesFor!(turnToneOpts),
  turnToneMode,
);
const uttToneSystem = buildSystemPrompt(
  VTCS.defaultPrompt(uttToneOpts),
  VTCS.categoriesFor!(uttToneOpts),
  uttToneMode,
);

/* ---- 1. Only categorical turn/utterance runs use the hand-written prompt ---- */

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
assert.equal(VTCS.defaultPrompt(turnOpts), vtcsPrompt("turn"));
assert.equal(VTCS.defaultPrompt(uttOpts), vtcsPrompt("utterance"));
assert.deepEqual(VTCS.categories, vtcsCategories("turn"), "the static categories are the turn set");

/* ---- 2. Prompt field + category boxes = the owner's v2 text ---- */

const norm = (s: string) => s.replace(/\s+/g, " ").trim();

// The one sanctioned difference: the paragraph introducing D3-D6 belongs to no
// single category box, so it sits just before the definitions instead of
// between D2 and D3.
const DISTRIBUTIVE =
  "Distributive codes (D3–D6). Distributive statements oppose the partner in an unbalanced way, not just what they are saying. Direct distributive statements are P, B or R (D3–D5). Indirect distributive statements are ID (D6), except that an indirect rejection, such as a dismissive question, is still R [CR5(a)].";

const expected = norm(fixture("vtcs-v2-turn-prompt.txt"));
const actual = norm(turnSystem);
for (const [name, text] of [["v2 fixture", expected], ["assembled prompt", actual]]) {
  assert.equal(text.split(DISTRIBUTIVE).length, 2, `${name} must contain the distributive paragraph once`);
}
assert.ok(
  actual.indexOf(DISTRIBUTIVE) < actual.indexOf("[D1] Integrative"),
  "the distributive paragraph must come before the definitions",
);
{
  const a = actual.replace(DISTRIBUTIVE, "").replace(/\s+/g, " ");
  const e = expected.replace(DISTRIBUTIVE, "").replace(/\s+/g, " ");
  if (a !== e) {
    let i = 0;
    while (i < a.length && a[i] === e[i]) i++;
    assert.fail(
      `assembled turn prompt differs from the v2 text at char ${i}:\n` +
        `  expected: …${e.slice(Math.max(0, i - 60), i + 80)}…\n` +
        `  actual:   …${a.slice(Math.max(0, i - 60), i + 80)}…`,
    );
  }
}
for (const system of [turnSystem, uttSystem]) {
  assert.ok(!system.includes(CATEGORIES_PLACEHOLDER), "the marker must be replaced");
  assert.ok(!system.includes("Categories to choose from"), "no second category block");
}

/* ---- 3. The tool matches the owner's v2 tool definition (turn mode) ---- */

const v2Tool = JSON.parse(fixture("vtcs-v2-tool.json"));
const turnTool = buildCodingTool(turnMode, VTCS.categories);
assert.equal(turnTool.name, v2Tool.name);
assert.equal(turnTool.description, v2Tool.description);
{
  // Enum order follows the category boxes (D1-D6 order); the set is what counts.
  const sortEnums = (schema: unknown): unknown =>
    JSON.parse(JSON.stringify(schema), (k, v) =>
      k === "enum" && Array.isArray(v) ? [...v].sort() : v,
    );
  assert.deepEqual(
    sortEnums(turnTool.input_schema),
    sortEnums(v2Tool.parameters),
    "the turn-mode tool schema no longer matches scripts/fixtures/vtcs-v2-tool.json",
  );
}
// A batch of ten has the same shape as a batch of one.
assert.deepEqual(
  buildCodingTool({ ...turnMode, batchSize: 10 }, VTCS.categories),
  turnTool,
  "batch size must not change the tool",
);
const uttTool = buildCodingTool(uttMode, VTCS.categoriesFor!(uttOpts));
const uttItems = (uttTool.input_schema.properties as Record<string, { items: { properties: Record<string, { items: { required: string[] } }> } }>)
  .units.items.properties.utterances.items;
assert.deepEqual(uttItems.required, ["text", "category", "rationale"]);

/* ---- 3b. Tone assessment: absent when off, after the code when on ---- */

const TONE = ["ambiguity", "other_reading", "confidence"];
/** The Output Format section heading (the intro also mentions "Output Format" in passing). */
const OUTPUT_HEADING = "\nOutput Format\n";
type Leaf = { properties: Record<string, unknown>; required: string[] };
const turnLeaf = (tool: typeof turnTool): Leaf =>
  (tool.input_schema.properties as Record<string, { items: Leaf }>).units.items;
const uttLeaf = (tool: typeof turnTool): Leaf =>
  (turnLeaf(tool).properties as Record<string, { items: Leaf }>).utterances.items;
const turnToneTool = buildCodingTool(turnToneMode, VTCS.categories);
const uttToneTool = buildCodingTool(uttToneMode, VTCS.categoriesFor!(uttToneOpts));
for (const [name, system, leaf] of [
  ["turn", turnSystem, turnLeaf(turnTool)],
  ["utterance", uttSystem, uttLeaf(uttTool)],
] as const) {
  assert.ok(!/CR7|ambiguity|other_reading/.test(system), `${name}: tone off must not mention tone`);
  for (const f of TONE) assert.ok(!(f in leaf.properties), `${name}: tone off has no ${f}`);
}
for (const [name, system, leaf, unitRequired] of [
  ["turn", turnToneSystem, turnLeaf(turnToneTool), ["unit_index", "category", "rationale"]],
  ["utterance", uttToneSystem, uttLeaf(uttToneTool), ["text", "category", "rationale"]],
] as const) {
  // The tone fields come after the code and its refinements, so the model
  // writes the code first.
  const keys = Object.keys(leaf.properties);
  assert.deepEqual(keys.slice(-3), TONE, `${name}: tone fields must be last`);
  assert.ok(keys.indexOf("category") < keys.indexOf("ambiguity"), `${name}: code before tone`);
  assert.deepEqual(leaf.required, [...unitRequired, ...TONE], `${name}: tone fields are required`);
  const cr6 = system.indexOf("[CR6]");
  const cr7 = system.indexOf("[CR7]");
  const out = system.indexOf(OUTPUT_HEADING);
  assert.ok(cr6 < cr7 && cr7 < out, `${name}: [CR7] sits after [CR6] and before Output Format`);
  assert.ok(system.includes("• confidence (required)"), `${name}: Output Format lists the tone fields`);
}
// Tone on changes nothing before [CR7]: everything the model reads ahead of
// the new rule is the validated v2 text.
assert.ok(turnToneSystem.startsWith(turnSystem.slice(0, turnSystem.indexOf(OUTPUT_HEADING))));

/* ---- 4. Every cited label is defined, in both modes ---- */

const LABEL = /\b(D\d+(?:\.\d+)?|CR\d+(?:\([a-z]\))?)/g;

function definedLabels(system: string): Set<string> {
  const out = new Set<string>();
  for (const m of system.matchAll(/^(?:• )?\[(D\d+(?:\.\d+)?|CR\d+(?:\([a-z]\))?)\]/gm)) {
    out.add(m[1]);
  }
  return out;
}

function citedLabels(text: string): string[] {
  return [...text.matchAll(LABEL)].map((m) => m[1]);
}

for (const [name, system, tool, tone] of [
  ["turn", turnSystem, turnTool, false],
  ["utterance", uttSystem, uttTool, false],
  ["turn+tone", turnToneSystem, turnToneTool, true],
  ["utterance+tone", uttToneSystem, uttToneTool, true],
] as const) {
  const defined = definedLabels(system);
  for (const l of ["D1", "D2", "D3", "D4", "D5", "D6", "CR1", "CR2", "CR3", "CR4", "CR5", "CR6", ...(tone ? ["CR7"] : [])]) {
    assert.ok(defined.has(l), `${name}: ${l} is not defined`);
  }
  for (const label of [...citedLabels(system), ...citedLabels(JSON.stringify(tool))]) {
    assert.ok(defined.has(label), `${name}: cites ${label}, which is not defined`);
  }
}

/* ---- 5. Categories: six codes in label order, editor titles, both modes ---- */

const EXPECTED_TITLES: Record<string, string> = {
  IN: "Integrative (IN) — the default",
  NC: "Non-Continuity (NC)",
  P: "Prescription (P)",
  B: "Blame (B)",
  R: "Rejection (R)",
  ID: "Indirect Distributive (ID)",
};

/** Mirrors splitDefinition in app/coding/components/sections/SectionScheme.tsx. */
function titleOf(description: string): string {
  const text = description.trim().replace(/^\[[^\]]+\]\s*/, "");
  const m =
    text.match(/^([^.!?\n]*[.!?])[ \t]+([\s\S]*)$/) ?? text.match(/^([^\n]*)\n([\s\S]*)$/);
  return m && m[2].trim() ? m[1].replace(/[.!?]+\s*$/, "").trim() : "";
}

for (const unit of ["turn", "utterance"] as const) {
  const cats = vtcsCategories(unit);
  assert.deepEqual(cats.map((c) => c.name), ["IN", "NC", "P", "B", "R", "ID"]);
  for (const cat of cats) {
    assert.equal(titleOf(cat.description), EXPECTED_TITLES[cat.name], `${unit}: title of ${cat.name}`);
  }
}
assert.notDeepEqual(
  vtcsCategories("turn"),
  vtcsCategories("utterance"),
  "utterance mode must reword the definitions",
);

/* ---- 6. User message: [unit_index N], timestamps only on timed turns ---- */

const seg = (over: Partial<PreSegment>): PreSegment => ({
  index: 1,
  kind: "turn",
  text: "So is there a problem with me?",
  startTime: 12.4,
  endTime: 15,
  wordCount: 7,
  turnNumber: 3,
  speaker: "Husband",
  ...over,
});
const timed = buildUserMessage([seg({ turnNumber: 2, startTime: 75, endTime: 80 })], [seg({})], []);
assert.ok(timed.includes("[unit_index 0] [00:12] [Turn 3] Husband: So is there"), timed);
assert.ok(timed.includes("[01:15] [Turn 2] Husband:"), "context turns carry stamps too");
const untimed = buildUserMessage([], [seg({ startTime: 0, endTime: 0 })], []);
assert.ok(untimed.includes("[unit_index 0] [Turn 3] Husband:"), "an untimed turn gets no stamp");

/* ---- 7. Prompts without the marker keep the old end-append ---- */

const custom = [
  { name: "A", description: "first" },
  { name: "B", description: "costs $400 and $& more" },
];
assert.equal(
  buildSystemPrompt("Code it.", custom, turnMode),
  'Code it.\n\nCategories to choose from:\n- "A": first\n- "B": costs $400 and $& more',
);
assert.equal(
  buildSystemPrompt(`Before\n${CATEGORIES_PLACEHOLDER}\nAfter`, custom, turnMode),
  "Before\nA: first\n\nB: costs $400 and $& more\nAfter",
  "spliced definitions are verbatim (named when the code is missing), $ included",
);

/* ---- 8. Tone fields are read leniently and never reject a unit ---- */

{
  const ctx = buildParseContext(turnMode, VTCS.categories, [seg({})]);
  const parse = (extra: object) =>
    parseUnitEntry(ctx, seg({}), { category: "IN", rationale: "r", ...extra })?.units[0];

  const bare = parse({});
  assert.ok(bare, "a unit without tone fields still parses");
  assert.equal(bare.ambiguity, undefined);
  assert.equal(bare.confidence, undefined);

  const full = parse({ ambiguity: " Could be dismissive. ", other_reading: "R", confidence: 0.4 });
  assert.equal(full?.ambiguity, "Could be dismissive.");
  assert.equal(full?.otherReading, "R");
  assert.equal(full?.confidence, 0.4);

  assert.equal(parse({ confidence: 1.4 })?.confidence, 1, "confidence is clamped to 1");
  assert.equal(parse({ confidence: -2 })?.confidence, 0, "confidence is clamped to 0");
  assert.equal(parse({ confidence: "high" })?.confidence, undefined, "a non-number is dropped");
  assert.equal(parse({ other_reading: "IN" })?.otherReading, null, "repeating the code is null");
  assert.equal(parse({ other_reading: "XX" })?.otherReading, null, "an unknown code is null");
  assert.equal(parse({ other_reading: null })?.otherReading, null);

  const uttCtx = buildParseContext(uttMode, VTCS.categoriesFor!(uttOpts), [seg({})]);
  const utt = parseUnitEntry(uttCtx, seg({}), {
    utterances: [{ text: "So is there", category: "ID", rationale: "r", other_reading: "IN", confidence: 0.5 }],
  });
  assert.equal(utt?.units[0].otherReading, "IN");
  assert.equal(utt?.parsed[0].confidence, 0.5, "the log carries the tone fields too");
}

console.log(
  `check-vtcs: OK (turn ${turnSystem.length} chars, utterance ${uttSystem.length} chars, ` +
    `${VTCS.categories.length} categories)`,
);
