/**
 * WHAT:    Keyless checks for the human-coded CSV path: parses the owner's
 *          fixture (for_claude/to_test.csv), checks the conversation grouping,
 *          the turn invariants, that the human code never reaches a segment,
 *          the audit CSV round trip, a synthetic utterance-mode export, and the
 *          autosave v6 -> v7 migration. Exits non-zero on the first failure.
 * STEP:    Development only. Run with `npx --yes tsx scripts/check-csv.ts`.
 * RUNS ON: node
 */
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import { parseCsv } from "@/lib/transcript/parse-csv";
import {
  conversationIdOf,
  csvToConversations,
  humanCodeAt,
  topicOf,
  turnsFromCsv,
} from "@/lib/transcript/csv-conversations";
import { segmentFile } from "@/lib/transcript/segment";
import {
  generateAuditCsv,
  auditCsvFileName,
  indexLogsByUnit,
} from "@/lib/results/generate-audit-csv";
import { agreeCell, computeAgreement } from "@/lib/results/agreement";
import { deserialize } from "@/app/coding/hooks/autosave-schema";
import type {
  ApiLog,
  CodedUnit,
  CsvSource,
  PreSegment,
  RunConfigSnapshot,
  TranscriptFile,
} from "@/lib/types";

const FIXTURE = "for_claude/to_test.csv";
const SAMPLE_CONVERSATION = "mel_fsu_2089_1";
const SAMPLE_ROWS = 37;

let checks = 0;
function ok(condition: unknown, message: string): void {
  checks++;
  assert.ok(condition, message);
}

function fileFrom(source: CsvSource, id: string): TranscriptFile {
  const turns = turnsFromCsv(source);
  return {
    id,
    fileName: `${source.fileName} · ${source.conversationId}`,
    rawTranscript: null,
    turns,
    codedUnits: [],
    selected: true,
    status: "done",
    progress: { completed: turns.length, total: turns.length },
    topic: topicOf(source),
    source,
  };
}

const CONFIG: RunConfigSnapshot = {
  runId: "check",
  startedAt: "2026-09-16T00:00:00.000Z",
  modelId: "claude-haiku-4-5-20251001",
  modelName: "Claude Haiku 4.5",
  provider: "anthropic",
  reasoningEffort: "medium",
  schemeId: "vtcs",
  schemeName: "VTCS",
  categories: ["IN", "NC", "ID", "P", "B", "R"].map((name) => ({
    name,
    description: `${name} definition`,
  })),
  categoriesDirty: false,
  segmentation: "turn",
  outputType: "categorical",
  scale: { min: 1, max: 7 },
  windowSeconds: 30,
  perSpeaker: true,
  batchSize: 1,
  contextBefore: 5,
  contextAfter: 5,
  systemPrompt: "prompt",
  promptDirty: false,
};

// ── 1. The fixture parses into the expected conversations ────────────────────

const text = readFileSync(FIXTURE, "utf8");
const conversations = csvToConversations("to_test.csv", text);
ok(conversations.length === 25, `expected 25 conversations, got ${conversations.length}`);
const totalRows = conversations.reduce((n, c) => n + c.rows.length, 0);
ok(totalRows === 2088, `expected 2088 rows, got ${totalRows}`);
const sample = conversations.find((c) => c.conversationId === SAMPLE_CONVERSATION);
ok(sample, `conversation ${SAMPLE_CONVERSATION} present`);
ok(sample!.rows.length === SAMPLE_ROWS, `${SAMPLE_CONVERSATION} has ${SAMPLE_ROWS} rows`);
ok(sample!.keys.humanCode === "final_code", "final_code column resolved");
ok(topicOf(sample!) === "Drug Use", `topic of ${SAMPLE_CONVERSATION} is Drug Use`);

const tally: Record<string, number> = {};
for (const c of conversations) {
  for (let i = 1; i <= c.rows.length; i++) {
    const code = humanCodeAt(c, i);
    tally[code] = (tally[code] ?? 0) + 1;
  }
}
assert.deepEqual(
  tally,
  { IN: 1285, ID: 216, NC: 160, B: 102, P: 62, R: 60, "": 203 },
  "human code tally",
);
checks++;

for (const c of conversations) {
  const turns = turnsFromCsv(c);
  ok(turns.length === c.rows.length, `${c.conversationId}: one turn per row`);
  turns.forEach((t, i) => {
    ok(t.turnNumber === i + 1, `${c.conversationId}: turnNumber is position`);
    ok(
      t.speaker === c.rows[i].values.speaker.trim(),
      `${c.conversationId}: speaker verbatim`,
    );
    ok(t.text === c.rows[i].values.text.trim(), `${c.conversationId}: text verbatim`);
    ok(t.speaker === "Husband" || t.speaker === "Wife", `${c.conversationId}: known speaker`);
    if (i > 0) {
      ok(t.speaker !== turns[i - 1].speaker, `${c.conversationId}: speakers alternate`);
    }
    ok(
      conversationIdOf(c.rows[i].values.exchange_id) === c.conversationId,
      `${c.conversationId}: exchange_id prefix`,
    );
  });
}

// ── 2. Segmentation never sees the human code ────────────────────────────────

const sampleFile = fileFrom(sample!, "f-sample");
const timeCut = segmentFile(sampleFile, { segmentation: "time", outputType: "categorical" });
ok(!timeCut.ok, "time mode is refused for a CSV file");
const turnCut = segmentFile(sampleFile, { segmentation: "turn", outputType: "categorical" });
ok(turnCut.ok, "turn mode works for a CSV file");
if (turnCut.ok) {
  ok(turnCut.segments.length === SAMPLE_ROWS, `${SAMPLE_ROWS} segments`);
  const allowed = new Set<keyof PreSegment>([
    "index",
    "kind",
    "text",
    "startTime",
    "endTime",
    "wordCount",
    "turnNumber",
    "speaker",
    "speakers",
  ]);
  for (const seg of turnCut.segments) {
    for (const key of Object.keys(seg)) {
      ok(allowed.has(key as keyof PreSegment), `segment key ${key} is a PreSegment field`);
    }
  }
  const wire = JSON.stringify(turnCut.segments);
  ok(!wire.includes("final_code"), "segments do not mention final_code");
}

// ── 3. Audit CSV round trip with no results ──────────────────────────────────

const files = conversations.map((c, i) => fileFrom(c, `f${i}`));
const emptyExport = generateAuditCsv({
  files,
  apiLogs: [],
  config: CONFIG,
  includeBulky: true,
});
const reparsed = parseCsv(emptyExport);
ok(reparsed.rows.length === totalRows, "one export row per original row");
const originalHeader = conversations[0].columns;
assert.deepEqual(reparsed.header.slice(0, originalHeader.length), originalHeader, "original header first");
checks++;
ok(reparsed.header.includes("ai_code"), "ai_code column present");
ok(reparsed.header.includes("call_cost_usd"), "call_cost_usd column present");
ok(reparsed.header.includes("run_total_cost_usd"), "run_total_cost_usd column present");
ok(reparsed.header.includes("system_prompt"), "bulky columns present when requested");
ok(reparsed.header.filter((h) => h === "ai_code").length === 1, "no duplicate header");
{
  let k = 0;
  for (const c of conversations) {
    for (const row of c.rows) {
      const out = reparsed.rows[k++];
      originalHeader.forEach((col, ci) => {
        assert.equal(out[ci], row.values[col], `cell ${col} of row ${row.rowIndex} survives the round trip`);
      });
      checks++;
    }
  }
}
const slimExport = generateAuditCsv({ files, apiLogs: [], config: CONFIG, includeBulky: false });
ok(
  parseCsv(slimExport).header.length === reparsed.header.length - 4,
  "slim export drops exactly the four bulky columns",
);
ok(auditCsvFileName(files, "abc") === "to_test_coded_abc.csv", "export file name");

// ── 4. Synthetic utterance-mode results join to their rows and calls ─────────

{
  const seg = turnsFromCsv(sample!)[2]; // turn 3
  const units: CodedUnit[] = [
    {
      unitId: "T3.U1",
      turnNumber: 3,
      utteranceIndex: 1,
      speaker: seg.speaker,
      text: seg.text.slice(0, 10),
      startTime: 0,
      endTime: 0,
      wordCount: 2,
      kind: "utterance",
      category: humanCodeAt(sample!, 3) || "IN",
      rationale: "first act",
    },
    {
      unitId: "T3.U2",
      turnNumber: 3,
      utteranceIndex: 2,
      speaker: seg.speaker,
      text: seg.text.slice(10),
      startTime: 0,
      endTime: 0,
      wordCount: 3,
      kind: "utterance",
      category: "ZZZ",
      rationale: "second act, with a \"quote\" and, a comma",
    },
  ];
  const log: ApiLog = {
    turnNumber: 3,
    speaker: seg.speaker,
    segmentation: "utterance",
    unitIds: ["T3.U1", "T3.U2"],
    fileName: sampleFile.fileName,
    fileId: sampleFile.id,
    model: CONFIG.modelId,
    systemPrompt: "SYSTEM\nline two",
    userMessage: "USER",
    toolDefinition: { name: "code_exchange" },
    rawResponse: { id: "msg_1" },
    parsedUnits: units.map((u) => ({ unitId: u.unitId, rationale: u.rationale })),
    attempt: 0,
    timestamp: "2026-09-16T00:00:01.000Z",
    contextBefore: 5,
    contextAfter: 5,
    contextBeforeTurnNumbers: [1, 2],
    contextAfterTurnNumbers: [4, 5, 6, 7, 8],
    usage: { inputTokens: 123, outputTokens: 45, cacheReadTokens: 0, cacheWriteTokens: 0 },
    costUsd: 0.001,
    attempts: 1,
  };
  const codedFile: TranscriptFile = { ...sampleFile, codedUnits: units };
  const byUnit = indexLogsByUnit([log]);
  ok(byUnit.get("T3.U2")?.callIndex === 0, "unit joins to its call");

  const csv = generateAuditCsv({
    files: [codedFile],
    apiLogs: [log],
    config: { ...CONFIG, segmentation: "utterance" },
    includeBulky: true,
  });
  const parsed = parseCsv(csv);
  ok(parsed.rows.length === SAMPLE_ROWS + 1, "turn 3 fans out into two rows");
  const col = (name: string) => parsed.header.indexOf(name);
  const turn3 = parsed.rows.filter((r) => r[col("exchange_id")] === `${SAMPLE_CONVERSATION}_3`);
  ok(turn3.length === 2, "two rows share exchange_id _3");
  ok(turn3[0][col("ai_unit_id")] === "T3.U1" && turn3[1][col("ai_unit_id")] === "T3.U2", "unit ids in order");
  const expectedAgree = humanCodeAt(sample!, 3) ? "1" : "";
  ok(turn3[0][col("agree")] === expectedAgree, `agree for T3.U1 is "${expectedAgree}"`);
  ok(turn3[1][col("agree")] === (humanCodeAt(sample!, 3) ? "0" : ""), "agree for T3.U2");
  ok(turn3[1][col("input_tokens")] === "123", "input_tokens joined from the call");
  ok(turn3[1][col("call_cost_usd")] === "0.00100000", "call_cost_usd joined from the call");
  ok(turn3[1][col("run_total_cost_usd")] === "0.00100000", "run total cost");
  ok(turn3[1][col("run_total_calls")] === "1", "run total calls");
  ok(turn3[1][col("context_after_turns")] === "4;5;6;7;8", "context turn numbers joined");
  ok(turn3[1][col("system_prompt")] === "SYSTEM\nline two", "multi-line system prompt survives");
  ok(turn3[1][col("ai_rationale")] === units[1].rationale, "quoted rationale survives");
  ok(turn3[1][col("ai_unit_text")] !== turn3[1][col("text")], "utterance text differs from the turn text");
  ok(parsed.rows[0][col("ai_code")] === "", "uncoded rows have blank result cells");
  ok(parsed.rows[0][col("run_id")] === "check", "uncoded rows still carry the run id");

  const agreement = computeAgreement(sample!, units);
  ok(agreement !== null, "agreement computed");
  const coded3 = humanCodeAt(sample!, 3) !== "";
  ok(agreement!.n === (coded3 ? 2 : 0), "agreement n counts units with a human code");
  ok(agreeCell("", units[0]) === "", "blank human code -> blank agree");
  ok(agreeCell("in", { ...units[0], category: "IN" }) === "1", "agree is case-insensitive");
  ok(agreeCell("IN", { ...units[0], error: true }) === "", "error unit -> blank agree");
}

// ── 5. Autosave v6 -> v7 ─────────────────────────────────────────────────────

{
  const v6 = {
    version: 6,
    files: [
      {
        id: "j1",
        fileName: "sample.json",
        rawTranscript: { language_code: "eng", language_probability: 1, text: "", words: [] },
        selected: true,
        topic: "chores",
      },
    ],
    selectedModel: "",
    reasoningLevel: "medium",
    schemeId: "vtcs",
    segmentation: "turn",
    outputType: "categorical",
    scale: { min: 1, max: 7 },
    windowSeconds: 30,
    perSpeaker: true,
    batchSize: 1,
    categories: [{ name: "IN", description: "" }],
    categoriesDirty: false,
    systemPrompt: "p",
    promptDirty: false,
    contextBefore: 5,
    contextAfter: 5,
  };
  const migrated = deserialize(JSON.stringify(v6));
  ok(migrated !== null, "v6 blob deserializes");
  ok(migrated!.version === 7, "migrated to v7");
  ok(migrated!.files[0].source === undefined && migrated!.files[0].fileName === "sample.json", "JSON file entry intact");

  const v7 = { ...v6, version: 7, files: [{ ...v6.files[0], rawTranscript: null, source: sample }] };
  const restored = deserialize(JSON.stringify(v7));
  ok(restored?.files[0].source?.rows.length === SAMPLE_ROWS, "CSV source survives a save/load");
}

console.log(`check-csv: ${checks} checks passed`);
