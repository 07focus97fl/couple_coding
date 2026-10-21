# Couple Conversation Coder

A web app for relationship researchers. Upload a couple's conversation transcript, pick a
large language model and a coding scheme, and the model codes every unit of the conversation:
one category per unit (for example the six VTCS codes) or a set of continuous ratings. Results
stream in live, show up in a results panel, and export to CSV. Everything you set up, including
the transcripts, autosaves in your browser.

Transcripts are ElevenLabs word-level JSON (`words[]` with `speaker_id`, `start`, `end`). You can
also upload audio (mp3, mp4, wav) and have the app transcribe it through ElevenLabs. To test the
model against conversations your coders have already coded, upload a CSV with one row per turn
(see "Testing against human-coded conversations" below): each conversation in it becomes its own
row in the Upload step, and the export is your file with the model's results and the run's
configuration appended.

API keys are bring-your-own. Each key is entered in the browser, kept in that browser's
localStorage, and sent to the server only inside the one request it authorises. The server never
stores a key and reads no environment variables.

## Run it locally

```bash
npm install
npm run dev        # http://localhost:3000
npm run build      # type-checks and builds
npm run lint
```

Try it with `public/scribe-v1-example.json` (a two-turn sample). You will need an API key for
at least one provider (Anthropic, OpenAI or Google), entered in the Model step. Audio
transcription needs an ElevenLabs key, entered in the Upload step.

## How a run works

The `/coding` page is four numbered steps, and the code is organised the same way. Each step
has one section component (what you see), one hook (its state and actions), and the `lib/`
files it calls.

| Step | What you do | Component | Hook | Library code |
|---|---|---|---|---|
| 01 Upload | Add transcript JSON, a human-coded CSV, or audio; transcribe audio | `sections/SectionUpload.tsx` | `hooks/useTranscriptFiles.ts` | `lib/transcript/parse-transcript.ts`, `lib/transcript/csv-conversations.ts`, `app/api/transcribe/route.ts` |
| 02 Model | Pick provider + model, enter its key | `sections/SectionModel.tsx` | `hooks/useModelAndKeys.ts` | `lib/models.ts` |
| 03 Scheme | Pick a scheme, edit categories, choose the coding mode, edit the prompt, set context | `sections/SectionScheme.tsx` (+ `PromptEditor`, `TopicTable`) | `hooks/useSchemeSettings.ts` | `lib/schemes/*` |
| 04 Run | Run or stop, watch progress and cost, inspect results and agreement, export CSV | `sections/SectionRun.tsx`, `run/*` | `hooks/useCodingRun.ts` | `lib/transcript/segment.ts` → `POST /api/code` → `lib/coding/*` → `lib/llm/*` → `lib/results/*` |

When you press Run, the browser freezes a copy of the settings (`RunConfigSnapshot`), cuts each
selected file into units (`segmentFile` in `lib/transcript/segment.ts`) and POSTs them with your
settings to `/api/code`. The server builds a plan (final prompt, the JSON schema of the tool the
model must call, batches, token budget), codes the batches five at a time with retries, and
streams each coded unit, each API log and a progress counter back as Server-Sent Events. The
browser appends them to the file as they arrive. Stop aborts the request: the server starts no
further batches and later files are not sent.

## Testing against human-coded conversations

Upload a `.csv` with one row per speaking turn. Required columns: `exchange_id` (everything
before its last `_N` is the conversation id, so `mcn_fsu_4221_1_17` belongs to `mcn_fsu_4221_1`),
`speaker`, `text`. Optional: `topic` (pre-fills the topic table), `start_time` / `end_time`
(seconds or `m:ss` from the start of the conversation; the start becomes the `[00:12]` stamp the
VTCS 15-second NC rule reads, and a missing end is taken from the next turn's start) and
`final_code` (the human code). Any other column is kept and written back. Every conversation
becomes its own row in the Upload step, so tick one or two for a cheap trial before running
them all. Time-window segmentation is unavailable for these rows (no word-level timings).
`for_claude/mock_test_format.csv` is a small working example and `for_claude/test_csv_format.md`
the full spec.

**The human code never reaches the model.** It lives only in `TranscriptFile.source.rows`;
`segmentFile` builds the units from `turns` (speaker + text), and the request body is an explicit
field list. `scripts/check-csv.ts` asserts this against the fixture (`npx --yes tsx scripts/check-csv.ts`).

After the run, each result row shows the human code beside the model's, each card shows its
agreement rate, and the Run step shows a human × model confusion table (blank human codes and
rows the model could not code are left out). **Export audit CSV** downloads your file with these
groups of columns appended, one output row per coded unit (utterance mode fans a turn out into
several rows that repeat the original cells):

| Group | Columns |
|---|---|
| result | `ai_code`, `ai_subcategory`, `ai_rationale`, `ai_alternatives`, `ai_ambiguity`, `ai_other_reading`, `ai_confidence` (VTCS turn/utterance, see below), `ai_rating_<dim>…` (continuous), `ai_error`, `ai_unit_id`, `ai_utterance_index`, `ai_unit_text`, `agree` (1/0, blank when there is nothing to compare) |
| run | `run_id`, `run_started_at`, `model_id`, `model_name`, `provider`, `reasoning_effort`, `scheme_id`, `scheme_name`, `segmentation`, `output_type`, `tone_assessment` (1/0), `batch_size`, `context_before`, `context_after`, `prompt_edited`, `categories_edited`, `categories_json`, `scale_json` (continuous) |
| price | `price_*_per_1m` (the catalog rates used), `run_total_calls`, `run_total_cost_usd` |
| call | `call_index`, `call_timestamp`, `call_attempts`, `input_tokens`, `output_tokens`, `cache_read_tokens`, `cache_write_tokens`, `call_cost_usd`, `context_before_turns`, `context_after_turns` |
| bulky (optional) | `system_prompt` (the final prompt as sent), `user_message`, `tool_definition_json`, `raw_response_json` |

**Tone ambiguity (optional, off by default).** For VTCS categorical turn and utterance runs, the
**Tone** toggle in the Scheme step (**off** / **assess**) adds prompt section [CR7] and three tool
fields that the model returns after the code. With it off, the model gets the owner's v2 prompt and
tool exactly (`scripts/check-vtcs.ts` checks this against `scripts/fixtures/`). The [CR7] text is
read before coding, so it could nudge the codes. To measure that, code the same conversations
tone-off twice and tone-on once, then compare by `run_id` and `tone_assessment`: the off-vs-off
difference is the normal run-to-run noise. The toggle regenerates the default prompt, asking first
if you have edited it. `ai_ambiguity` is one or two sentences on how the *tone*
it was said in could change the code ("None." if no tone would). Only tone counts here; other
doubt goes in `ai_alternatives`. `ai_other_reading` is the code a different tone would most
plausibly give (blank if none). `ai_confidence` (0–1) is how well the code can be told without
hearing the tone. A low score does not mean another code is likelier: it means the tone would
decide, so sort by it to find the units a human should listen to. The parser is lenient: a missing
or malformed tone field is left blank and never costs a retry. The regular CSV export has the same
three columns. The columns are there even when tone is off (blank then), so exports from on and
off runs stack into one table.

`call_cost_usd` is the measured price of the API call that produced the row (provider-reported
usage × catalog price), so a one-conversation trial tells you what a full run will cost. With
`batch_size > 1` the same call repeats on every unit of its batch; sum by distinct `call_index`
or read `run_total_cost_usd`. One export per run: stack exports from different prompts or models
into one long table and compare by `run_id`.

## File map

All paths under `app/coding/` are relative to that folder.

**Pages and chrome**

| File | What it is |
|---|---|
| `app/page.tsx` + `app/landing.module.css` | The landing page at `/`. Its copy is typed by hand. |
| `app/layout.tsx`, `app/globals.css` | Root HTML shell, fonts, Tailwind and shadcn tokens. |
| `app/coding/page.tsx` | The `/coding` page. Provides the session and stacks the four steps. No logic. |
| `components/layout/StickyHeader.tsx`, `StageRail.tsx`, `Hero.tsx`, `SectionShell.tsx` | Top bar, left step rail, heading, and the collapsible frame every step sits in. |
| `app/logs/page.tsx`, `app/logs/PromptViewer.tsx` | The `/logs` debug view of the last run's API calls. |

**State (all in `app/coding/hooks/`)**

| File | What it holds |
|---|---|
| `useCodingSession.ts` | The composer. Calls the hooks below and assembles the one `CodingSession` object every component reads. Holds no logic; edit the step hook instead. |
| `CodingSessionContext.tsx` | Provides that object through React context (`useSession()`). |
| `useTranscriptFiles.ts` | Upload: the file list, drag-and-drop, JSON reading, CSV splitting into conversations, audio transcription, the ElevenLabs key. |
| `useModelAndKeys.ts` | Model: selected model, reasoning level, the three provider keys, the active provider. |
| `useSchemeSettings.ts` | Scheme: scheme, categories, coding mode, prompt, context before/after. |
| `useCodingRun.ts` | Run: `runCoding` / `stopRun`, reading the stream, API logs, the run-config snapshot, progress, export-all and the audit export. |
| `useSessionPersistence.ts`, `useAutosave.ts`, `autosave-schema.ts` | Loading the saved session on start, the snapshot to save, the debounced writer, and the saved shape with its migrations. |
| `useRunScope.ts`, `useRunStats.ts`, `useScrollSpy.ts` | Pre-run call count; live elapsed/rate/ETA/cost; which step is in view. |

**Library (`lib/`), in pipeline order**

| Folder / file | What it does |
|---|---|
| `types.ts` | Every shared type and default. Read this first. |
| `models.ts`, `usage.ts` | Model catalog with prices; token-usage normalisation and cost math. |
| `transcript/` | Words → speaking turns (`parse-transcript.ts`), a human-coded CSV → conversations and turns (`parse-csv.ts`, `csv-conversations.ts`), file-origin helpers (`file-origin.ts`), the segmentation seam (`segment.ts`), fixed time windows (`segment-time.ts`). |
| `schemes/` | One file per coding scheme, the registry (`index.ts`), and the editable default prompt builder (`default-prompt.ts`). |
| `coding/` | Server-side engine: final prompt and user message (`build-messages.ts`), the forced tool schema and token budget (`build-tool.ts`), batching (`batching.ts`), the run plan, retry loop and worker pool (`code-segments.ts`), backoff retry rules (`retry.ts`), turning tool payloads into rows (`parse-response.ts`), the SSE wire format (`sse.ts`). |
| `llm/` | One adapter per provider behind `runStructuredCall()` (`index.ts`). |
| `results/` | What happens to coded units after they come back: utterance re-timing, ordering, CSV (`generate-csv.ts`, `csv-escape.ts`), the audit export (`generate-audit-csv.ts`), human-vs-model agreement (`agreement.ts`), category colours. |
| `utils.ts` | shadcn's `cn()` helper. |

**Results UI (`app/coding/components/run/`)**: `ConversationCard.tsx` (one card per file),
`RunRow.tsx` (one coded unit), `CategoryHistogram.tsx`, `ConfusionMatrix.tsx` (human × model
agreement), `ExportButton.tsx` + `ExportDialog.tsx`, `AuditExportDialog.tsx`.

**UI kit**: `components/ui/*` are shadcn primitives (button, checkbox, dialog, label, select).
Most of the app is styled with CSS modules next to each component, not Tailwind.

Every source file starts with a header comment saying what it is, which step it belongs to, and
whether it runs on the server, the client, or both.

## `POST /api/code`

The body the browser sends (`CodeRequest` in `app/api/code/route.ts`):

| Field | Meaning |
|---|---|
| `segments` | The units to code, already cut by `lib/transcript/segment.ts` (`PreSegment[]`). |
| `mode` | `{ segmentation, outputType, scale?, windowSeconds?, perSpeaker?, batchSize?, toneAssessment? }` (`CodingMode`). `toneAssessment` is sent only for VTCS categorical turn/utterance runs. |
| `model` | A model id from `lib/models.ts`. The server resolves the provider from it. |
| `reasoningEffort` | `none` / `low` / `medium` / `high`; only forwarded for models flagged `reasoning`. |
| `categories` | `{ name, description }[]`; at least two non-blank names. In continuous mode these are the rating dimensions. |
| `systemPrompt` | The prompt from the editor. The server inserts the category (or rating) definitions where the prompt says `{{CATEGORIES}}`, or appends them as a block when it has no such marker. |
| `contextBefore`, `contextAfter` | How many neighbouring units to include as context. |
| `topic` | Optional conversation topic, prepended to every user message. |
| `apiKey` | The key for the model's provider. Used for this request only. |

Validation failures return `400 { "error": "..." }`. Otherwise the response is a
`text/event-stream` of these events, each `event: <name>` followed by `data: <JSON>`:

| Event | Data |
|---|---|
| `result` | `{ codedUnit }`: one coded row. Utterance and per-speaker modes yield several per unit. |
| `log` | An `ApiLog`: one per LLM call, with prompts, tool schema, raw response, usage and cost. |
| `progress` | `{ completed, total }`, counted in units. |
| `done` | `{}` when every batch is finished. |
| `error` | `{ message }` if a provider call throws; the stream closes. |

Inside: units are batched (`batchSize`, capped per method). Every call, even one coding a single
unit, is asked for a `units` array whose entries echo the `[unit_index N]` shown in the user
message; turns with timings are stamped with their elapsed start time (`[00:12]`); CSV turns
without timings are not. Each batch gets up to three attempts
to parse, still-missing units of a multi-unit batch are re-coded alone, and five batches run at
once. A unit that never parses becomes a row with `error: true`. A provider call that fails is
retried with backoff (rate limits, overloads, server and network errors, up to four times); if
it still fails, that batch's units become `error: true` rows carrying the provider's message and
the run goes on. The stream only ends with `error` when the key is rejected (401/403) or ten
batches fail in a row. Aborting the request (the Stop button) stops the engine from starting
more batches.

## `POST /api/transcribe`

Multipart form with the audio `file` and ElevenLabs options; the key goes in the
`x-elevenlabs-key` header. The route forwards the body to ElevenLabs and returns its JSON.

## Where state lives

- **React state**, one hook per step (see the State table). Coded results live only in memory.
- **localStorage**: `anthropic_api_key`, `openai_api_key`, `google_api_key`, `elevenlabs_api_key`,
  and `ccc_session_v3` (the autosaved session: files with their transcripts or CSV rows, model,
  scheme, categories, prompt, mode, context). The saved shape and its v3→v8 migration are in
  `app/coding/hooks/autosave-schema.ts`. Sessions over 3 MB are saved without word-level
  transcripts (CSV rows are small and are kept).
- **sessionStorage**: `api_logs`, the last run's logs, read by `/logs`.
- **Server**: nothing. No database, no environment variables.

## Glossary

- **Turn**: one stretch of speech by one speaker, cut where the speaker changes.
- **Utterance**: a piece of a turn that the model splits off as one behavioural act.
- **Time window**: a fixed number of seconds of conversation, possibly containing both speakers.
- **Unit**: whatever is being coded: a turn, an utterance, or a window (per speaker or whole).
  `CodedUnit` is the row you get back.
- **Segment / pre-segment**: a unit as it is sent to the server, before the model sees it.
- **Batch**: several consecutive segments coded in one API call.
- **Call**: one request to the model; one `ApiLog`.
- **Scheme**: a coding scheme (VTCS, custom): its categories and default prompt.
- **Mode**: segmentation × output type (categorical or continuous), plus scale, window and batch size.

## Where to look when you want to…

- **Add a coding scheme**: copy `lib/schemes/custom.ts`, fill in categories, register it in
  `lib/schemes/index.ts`. Give it a hand-written prompt like `vtcs.ts` if you want more than the
  generic default.
- **Add or re-price a model**: `lib/models.ts`. A new provider also needs an adapter in `lib/llm/`.
- **Change how units are cut**: `lib/transcript/segment.ts` (and `segment-time.ts` for windows).
- **Change what a human-coded CSV must contain, or how it is split**: `lib/transcript/csv-conversations.ts`
  (`parse-csv.ts` is the generic reader). The audit export's columns: `lib/results/generate-audit-csv.ts`;
  the agreement maths: `lib/results/agreement.ts`. Check both with `npx --yes tsx scripts/check-csv.ts`.
- **Change what the model is asked**: `lib/schemes/default-prompt.ts` for the editable default
  (`lib/schemes/vtcs.ts` for VTCS coding prompt v2, checked by `scripts/check-vtcs.ts` against
  `scripts/fixtures/`), `lib/coding/build-messages.ts` for where the definitions go and how
  context is laid out,
  `lib/coding/build-tool.ts` for the JSON shape the model must return.
- **Change how a response becomes rows**: `lib/coding/parse-response.ts`.
- **Change retries, batching or concurrency**: `lib/coding/code-segments.ts`, `lib/coding/batching.ts`,
  `lib/coding/retry.ts` (which errors are retried, and the backoff).
- **Change a CSV column**: `COLUMN_DEFINITIONS` in `lib/types.ts` and `lib/results/generate-csv.ts`.
- **Change what autosaves**: `app/coding/hooks/useSessionPersistence.ts` and `autosave-schema.ts`
  (bump the version and add a migration line).
- **Change the look of a step**: its `Section*.tsx` and the `.module.css` beside it.

## Conventions

- Server-only code lives in `lib/coding/` (except `batching.ts` and `sse.ts`) and `lib/llm/`.
  Never import it from a `"use client"` file; it would pull provider SDKs into the browser.
- Every source file starts with a `WHAT / STEP / RUNS ON` header comment. Keep it true.
- New state belongs in the hook for its step, not in `useCodingSession.ts`.
- Keys never touch the server beyond the one request they authorise.
- `docs/REFACTOR_2026-09.md` records the September 2026 review: what was found, what changed,
  and the known bugs still open.
