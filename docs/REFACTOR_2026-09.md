# Codebase review and transparency refactor (September 2026)

This document records what a full read of the codebase found, what was changed to make the
project easier to navigate, and every bug that turned up along the way. It is written for the
project owner, who is new to programming, so it favours plain language over jargon.

The refactor's rule was **reorganize and document, do not rebuild**. No features were added.
The app's behaviour is meant to be identical before and after, except for the small bug fixes
listed in section 4A.

---

## 1. What the app is

Researchers upload couple-conversation transcripts (ElevenLabs word-level JSON, or audio that the
app transcribes through ElevenLabs). They pick an LLM (Anthropic, OpenAI or Google) and a coding
scheme (VTCS, or their own custom categories), and the model codes every unit of the
conversation as either one category or a set of continuous ratings. A "unit" can be a speaking
turn, a model-split utterance inside a turn, or a fixed time window; several units can be batched
into one API call to save money. Results stream back live, show up in the Run panel, export to
CSV, and everything the user set up (plus the transcripts themselves) autosaves to the browser.

The UI is four numbered steps, and the code now mirrors them: **Upload → Model → Scheme → Run**.
The `README.md` has the file map; this document is the "why".

---

## 2. What was already good (and was left alone)

- `app/coding/page.tsx` is a 31-line composition of the four steps. It is the model the rest now follows.
- `app/coding/components/` was already split sensibly into `layout/` (chrome), `sections/` (the
  four steps) and `run/` (results), one CSS module per component. Component internals were not touched.
- The small hooks (`useAutosave`, `useRunScope`, `useScrollSpy`, `useRunStats`) are single-purpose.
- The `lib/` modules are individually small and mostly pure. The pipeline seams are clean:
  `segment()` → `PreSegment[]` → `chunkSegments()` → `buildCodingTool()`.
- Pricing and usage math is correct and lives in exactly one place each (`lib/models.ts` owns the
  rates, `lib/usage.ts` owns the normalization and the multiply).
- The client/server boundary is sound: no secrets leak, nothing reads `process.env`, API keys are
  bring-your-own and travel only inside the one request they authorise.

## 3. What made it hard to read

1. **Two files held 69% of the logic.** `useCodingSession.ts` was 1165 lines: one hook returning
   a 90-key object and mixing 13 unrelated concerns (file upload, audio transcription, four API
   keys, scheme selection, prompt regeneration, mode settings, autosave, the run loop, a
   hand-rolled SSE parser, utterance re-timing, CSV export, scroll-spy…). `app/api/code/route.ts`
   was 896 lines: one `POST` whose real engine lived five indent levels deep inside a
   `ReadableStream.start` callback.
2. **No documentation.** `README.md` was the untouched create-next-app template. `.env.example`
   described a "dev sign-in" feature and server-side keys that did not exist in code. No file
   said what it was for.
3. **Legacy leftovers that looked like live features.** `Granularity` next to
   `SegmentationStrategy`, `CodedTurn` next to `CodedUnit`, `contextWindow` next to
   `contextBefore/After`; the request body sent both `segments` and `turns` (the transcript
   serialized twice); the SSE `result` event carried the same object under two keys. A reader
   would assume there were two systems when there was one.
4. **Dead code a reader had to rule out.** A whole unused file (`lib/preview-sample.ts`), a
   one-line re-export shim, seven of twelve shadcn primitives never imported (590 lines), five
   leftover template SVGs, dead CSS blocks, a dozen unused exports.
5. **Names that disagreed.** Six words for the unit of analysis (turn / utterance / segment /
   unit / exchange / window); `apiKey` meant "the Anthropic key" in state but "whichever
   provider's key" on the wire; "VCTS" in labels vs `vtcs` in code (VTCS is correct); scheme ids
   in mixed case; two files called "prompts" that never referenced each other.
6. **The `/logs` page was hidden.** Reachable only from a button that appears after a run, in a
   new tab, from a frozen `sessionStorage` snapshot, and styled with 150 lines of inline styles.

---

## 4. Bugs found

### 4A. Small fixes applied in this refactor (each a few lines, no design decision needed)

| # | Where (pre-refactor path) | Problem | Fix | Status |
|---|---|---|---|---|
| A1 | `useCodingSession.ts:940` | The SSE parser reset `eventType` on every network chunk, so an event whose `event:` and `data:` lines arrived in different chunks was silently dropped: a lost coded row or log while progress still advanced. | Keep `eventType` across chunks (now in `lib/coding/sse.ts`). | fixed |
| A2 | `useCodingSession.ts:346-350` | `sessionStorage.setItem("api_logs", …)` had no try/catch; a long run exceeds the ~5 MB quota and the throw inside an effect crashes the page mid-run. Also never cleared on a new run, so `/logs` showed the previous run until the first new log. | try/catch; remove the key when logs are empty. | fixed |
| A3 | `useCodingSession.ts:300-314` | Files restored from autosave came back with no turns, so the Upload table showed "—" for turn count until a run. | Re-parse turns on restore. | fixed |
| A4 | `SectionScheme.tsx:349` | `key={i}` on the editable category list; deleting a middle row left the wrong row's open/closed state and textarea height. | Remount the rows on delete (a generation counter in the key). | fixed |
| A5 | `app/logs/page.tsx:64-66,99,119` | Expanded state and keys used the position in a list that re-sorts as logs arrive; an open card jumped to another log. | Key by arrival index. | fixed |
| A6 | `StageRail.tsx:31` | "Key linked" showed when an Anthropic key was saved but no model selected. | Require a selected model too. | fixed |
| A7 | `route.ts:252` | Malformed JSON body produced a framework 500 and a confusing client error. | Return a 400 with a clear message. | fixed |
| A8 | `app/api/transcribe/route.ts:58` | `upstream.json()` was unguarded. | try/catch → 502. | fixed |
| A9 | `useCodingSession.ts:872-884` | Segmentation ran before the `try`, so a throw aborted the multi-file loop with no file marked as errored. | Move inside the `try`. | fixed |
| A10 | `route.ts:296` | Error text said "No turns provided" for the `segments` field. | "No segments provided". | fixed |
| A11 | `lib/autosave-schema.ts:18` | Comment said the schema was v5; code was v6; the literal `6` was duplicated in the hook. | One exported `AUTOSAVE_VERSION`. | fixed |
| A12 | `ConversationCard.tsx:61`, `SectionRun.tsx:179` | Per-file cost joined logs on file *name*; two uploads with the same name merged costs and produced duplicate React keys. | Stamp `fileId` on each log; join on it. | fixed |
| A13 | `app/page.tsx:287` | Landing said "mp3, m4a, wav"; the app accepts mp3, mp4, wav. | Fix copy. | fixed |
| A14 | `app/layout.tsx:34` | Meta description said "using Claude AI"; three providers are supported. | Provider-neutral copy. | fixed |
| A15 | `app/globals.css:10` | `--font-sans: var(--font-sans)` was self-referential; Geist fonts were loaded and never used. | Point at a loaded font; drop Geist. | fixed |
| A16 | `app/api/code/route.ts` | No `maxDuration` (the transcribe route has one); serverless hosts would kill long runs silently. | Add `maxDuration = 300`. | fixed |
| A17 | `SectionUpload.tsx:253-262, 329-335` | Dropzone not keyboard-reachable; row checkbox had no accessible name. | `role`/`tabIndex`/key handler; `aria-label`. | fixed |

### 4B. Real bugs that need a design decision (documented, not fixed)

| # | Where (post-refactor path) | Problem | Suggested direction |
|---|---|---|---|
| B1 | `useAutosave.ts` + `useSessionPersistence.ts` | When the session exceeds 3 MB, autosave strips the transcripts ("metadata-only", reported as a success) and the next reload filters out every file without a transcript. The workspace comes back empty with no warning. `autosaveState` is computed and returned but never shown anywhere. | Show `autosaveState` in the header or rail ("Saved" / "Transcripts too large to save; re-upload after reload"). Optionally keep stripped files visible as rows needing re-upload. *Partly mitigated 2026-09-16: CSV-origin conversations keep their rows (small) through the over-budget save and come back after a reload; JSON/audio files behave as before.* |
| B2 | `lib/coding/code-segments.ts` | One provider error (e.g. a 429 rate limit) on one batch aborts the whole file: the stream emits a single `error` and closes while the other four workers keep making billable calls into a closed stream. Parse failures get three attempts; HTTP errors get none. | **Fixed 2026-09-16.** Provider calls are retried with backoff (`lib/coding/retry.ts`, 4 retries on 408/409/429/5xx/network); a batch that still fails yields error rows carrying the provider's message and the run continues; the file only aborts on a rejected key or 10 consecutive failures. |
| B3 | `useCodingRun.ts`, `route.ts` | No `AbortController` on the coding fetch, no `cancel()` on the server stream, no Stop button. Navigating away leaves the server coding and billing. (Audio transcription aborts correctly.) | **Fixed 2026-09-16.** Stop button + `AbortController` on the fetch; the route watches `request.signal` and the stream's `cancel()`, and the engine polls `shouldStop()` before each batch. Calls already in flight finish. |
| B4 | `SectionRun.tsx`, `useCodingRun.ts` | Two fast clicks can start two interleaved runs sharing one log array; deleting or deselecting a file mid-run makes its updates no-op while the server keeps coding. | **Half fixed 2026-09-16:** `runCoding` is guarded by a `runningRef` and the Run button is disabled while a run can be stopped. Removing a file mid-run is still possible (its updates no-op). |
| B5 | `route.ts` | `contextBefore/After` and `mode.scale` are not validated server-side. A huge context is an unbounded cost amplifier; `min > max` collapses every rating. | Clamp context (e.g. 0–50); validate `scale.min < scale.max` and finite. |
| B6 | `route.ts` | Continuous mode is forced to at least 2 dimensions by the categorical "at least 2 categories" check. | Require ≥1 when `outputType === "continuous"`. |
| B7 | `lib/coding/code-segments.ts`, `useRunStats.ts`, `logs/page.tsx` | A log's `usage` sums every attempt but `rawResponse` is only the last, so the raw body contradicts the cost. The legacy fallback re-derives from the last attempt only. | Store all raw responses, or say so in the log UI. |
| B8 | `SectionRun.tsx`, `ConversationCard.tsx` | "Cost per unit" divides by pre-segments completed, not coded rows; per-speaker time mode yields 2+ rows per window. | Divide by coded-unit count. |
| B9 | `useRunStats.ts` | A log whose usage could not be normalized contributes $0 but still counts as a call, deflating cost and rate. | Track and show unpriced calls. |
| B10 | `lib/results/align-utterances.ts` vs `lib/transcript/parse-transcript.ts` | `getTurnWords` re-derives a turn's words by speaker + time range, a different rule than the parser used, so the substring search can miss and the unit silently gets `approximateTiming`. | Store word index ranges on `SpeakingTurn` at parse time and slice by index. |
| B11 | `lib/llm/google.ts` | Gemini schema translation drops `additionalProperties: false`, so Gemini may return extra rating keys. | Harmless today because `parseRatings` keeps only known dimensions; documented. |
| B12 | `lib/schemes/vtcs.ts` | The hand-written VTCS prompts tell the model to return `"code"`, `"reasoning"`, `turn_number`, `speaker` and "a JSON array", but the forced tool requires `category`/`rationale` (and a `units[]` wrapper when batched). The tool wins; the model silently remaps. The category block is also appended a second time by `buildSystemPrompt`, and choosing time-window segmentation silently replaces the VTCS decision tree with the generic prompt. | Prompt-content decisions for the owner. |
| B13 | `lib/coding/code-segments.ts` | In a batched response, an entry without `unit_index` that fails validation does not advance the positional cursor, so the next entry is checked against the same segment. | **Fixed 2026-09-16.** The cursor advances on a failed positional entry. |
| B14 | `useCodingRun.ts` | Every appended log re-serializes the whole log array to `sessionStorage` (quadratic work during a run). | **Fixed 2026-09-16.** The mirror is written at most every 2 s during a run and once when it ends. The audit export reads the in-memory logs, never the mirror. |
| B15 | `useCodingSession.ts` | The context value is a fresh 90-key object every render; all consumers re-render on every keystroke and every streamed unit. `useRunScope` works around it with an `eslint-disable`. | Split the context, or memoize per step. |
| B16 | `route.ts` | No auth, rate limit, or body-size limit: anyone reaching a deployment can use it as an LLM proxy with their own key. Fine for local use. | Add before any public deploy. |

---

## 5. What changed

### 5.1 Target layout

`lib/` went from 17 flat files to 4 flat files + 5 folders that read in pipeline order.
Folders that would have held only one or two files were deliberately not created.

```
lib/
  types.ts                 all shared types + defaults
  models.ts                model catalog + pricing
  usage.ts                 token-usage normalization + cost
  utils.ts                 shadcn cn()
  transcript/              Upload step: words → turns / windows
    parse-transcript.ts  segment.ts  segment-time.ts
  schemes/                 Scheme step: the coding schemes + the editable default prompt
    index.ts  vtcs.ts  valence.ts  spaff.ts  rciss.ts  cirs.ts  custom.ts  default-prompt.ts
  coding/                  Run step, server side: one request → many LLM calls
    build-messages.ts      final system prompt + user message      (was app/api/code/prompts.ts)
    build-tool.ts          forced-tool JSON schema + token budget  (was lib/coding-tool.ts)
    batching.ts            group segments per call
    parse-response.ts      tool payload → CodedUnit rows           (extracted from route.ts)
    code-segments.ts       run plan, retry/fallback, worker pool   (extracted from route.ts)
    sse.ts                 the SSE wire format, both sides
  llm/                     provider adapters (unchanged)
  results/                 what happens to coded units after they come back
    align-utterances.ts  sort-units.ts  generate-csv.ts  category-colors.ts

app/coding/hooks/
  useCodingSession.ts        composer: the CodingSession interface + wiring
  useTranscriptFiles.ts      Upload
  useModelAndKeys.ts         Model
  useSchemeSettings.ts       Scheme
  useCodingRun.ts            Run
  useSessionPersistence.ts   autosave load + the persisted snapshot
  useAutosave.ts  autosave-schema.ts  useRunScope.ts  useRunStats.ts  useScrollSpy.ts
```

### 5.2 Removed (all verified to have no importers)

- Files: `lib/preview-sample.ts`; `lib/coding-schemes.ts`; `components/ui/{badge,card,input,progress,table,tabs,tooltip}.tsx`; `public/{file,globe,next,vercel,window}.svg`.
- Legacy compatibility: the `granularity`, `turns` and `contextWindow` request fields, the
  `Granularity` and `CodedTurn` types, the duplicate `codedTurn` SSE key. The autosave migration
  (v3 → v6) is kept so old saved sessions still load.
- Unused exports and context members: `DEFAULT_GRANULARITY`, `getProvider`, `SectionId`,
  `UsageTotals.callCount`, `PersistedSession.granularity`, `showKey`/`setShowKey`,
  `setActiveProviderKey`, `setGranularity`, the unused `schemeRules` parameter, an unreachable
  `/^o\d/` reasoning-model branch.
- Dead CSS: `.granularity*` in `PromptEditor.module.css`, `.cardHeadClosed`, unused keyframes in `coding.module.css`.

Kept on purpose: `categoriesDirty` / `resetCategories` (no UI yet, but plausibly wanted for a
"reset categories" button), `for_claude/raw_transcript_example.json` (owner's fixture), the
`.dark` token block in `globals.css` (shadcn boilerplate).

Unreachable UI branches, documented but left in place: the "Coming soon" model branch in
`SectionModel.tsx` (every catalog model is available), the "Pick a scheme" empty state in
`SectionScheme.tsx` (a fresh session always has VTCS selected), the hard-coded "MS" avatar in
`StickyHeader.tsx` (there is no login).

### 5.3 Renamed

| Was | Is now |
|---|---|
| "VCTS" in labels, prompt constants and landing copy | "VTCS" (the correct acronym) |
| `apiKey` / `setApiKey` (meant the Anthropic key) | `anthropicKey` / `setAnthropicKey` (localStorage key string unchanged) |
| Scheme ids `"SPAFF"`, `"RCISS"`, `"CIRS"` | lowercase, like the others |
| "Exchanges per call", "per exchange" | "Units per call", "per unit" |
| `codedTurns` prop, `coded_turns.csv` | `codedUnits`, `coded_units.csv` |
| `totalTurns` / `completedTurns` (they count units, not turns) | `totalUnits` / `completedUnits` |
| `ApiLog.granularity` | `ApiLog.segmentation` |
| `lib/prompt-defaults.ts`, `app/api/code/prompts.ts`, `lib/coding-tool.ts` | `lib/schemes/default-prompt.ts`, `lib/coding/build-messages.ts`, `lib/coding/build-tool.ts` |

Not renamed: the tool name `code_exchange` (changing it changes what the model sees) and
`ApiLog.turnNumber` (holds the window index in time mode; documented on the type instead).

---

## 6. Follow-ups not done here (out of scope for a reorganization)

- The B-bugs above that are still open (B1 in part, B4 in part, B5–B12, B15, B16). B2, B3, B13
  and B14 were fixed on 2026-09-16 alongside the human-coded CSV input.
- `useCodingRun.handleExportAll` builds the combined CSV by splitting `generateCsv` output on
  `"\n"`, which breaks a row whose rationale contains a line break. The audit export does not
  have this problem; the combined export should build rows from cells instead.
- CSS: the API-key block, the data table, the progress bar and the chevron rotation are each
  duplicated across two to five modules; the accent colour `#c45d3e` is hard-coded 32 times; the
  design tokens are declared three times (`globals.css`, `coding.module.css`, `landing.module.css`).
- `/logs` uses inline styles and re-hard-codes the palette; it could use a CSS module and be linked from the header.
- The landing page (`app/page.tsx`) retypes scheme names, provider names, accepted formats and
  the "coming soon" badges instead of reading them from `lib/`; they will drift.
- Optional: install the `server-only` package and import it at the top of `lib/llm/index.ts`
  and `lib/coding/code-segments.ts` so a client import fails at build time instead of silently
  pulling an SDK into the browser bundle.

---

## 7. How behaviour was verified

- `npx tsc --noEmit`, `npm run lint`, `npm run build` after every commit.
- A deterministic "request-side" capture (segments, batch grouping, tool JSON schema, the
  editable and final system prompts, the user message for the first/middle/last batch in ten
  segmentation × output × batch-size combinations, the CSV shape, and a v3-era autosave blob
  migrated through `deserialize`) was recorded on the sample transcript and on a synthesized
  24-turn transcript before any change and diffed after each structural commit. Everything the
  app computes before calling an LLM is byte-identical, so the model receives exactly the same
  requests as before.
- Manual pass through the UI: upload, reload (turn count survives), model + key, scheme edits
  with the confirm-on-dirty prompt, a run with batch size 1 and 3, `/logs`, CSV export.
