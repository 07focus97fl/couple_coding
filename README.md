# Couple Conversation Coder

A web app for relationship researchers. Upload a couple's conversation transcript, pick a
large language model and a coding scheme, and the model codes every unit of the conversation:
one category per unit (for example the six VTCS codes) or a set of continuous ratings. Results
stream in live, show up in a results panel, and export to CSV. Everything you set up, including
the transcripts, autosaves in your browser.

Transcripts are ElevenLabs word-level JSON (`words[]` with `speaker_id`, `start`, `end`). You can
also upload audio (mp3, mp4, wav) and have the app transcribe it through ElevenLabs.

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
| 01 Upload | Add transcript JSON or audio; transcribe audio | `sections/SectionUpload.tsx` | `hooks/useTranscriptFiles.ts` | `lib/transcript/parse-transcript.ts`, `app/api/transcribe/route.ts` |
| 02 Model | Pick provider + model, enter its key | `sections/SectionModel.tsx` | `hooks/useModelAndKeys.ts` | `lib/models.ts` |
| 03 Scheme | Pick a scheme, edit categories, choose the coding mode, edit the prompt, set context | `sections/SectionScheme.tsx` (+ `PromptEditor`, `TopicTable`) | `hooks/useSchemeSettings.ts` | `lib/schemes/*` |
| 04 Run | Run, watch progress and cost, inspect results, export CSV | `sections/SectionRun.tsx`, `run/*` | `hooks/useCodingRun.ts` | `lib/transcript/segment.ts` → `POST /api/code` → `lib/coding/*` → `lib/llm/*` → `lib/results/*` |

When you press Run, the browser cuts each selected transcript into units
(`lib/transcript/segment.ts`) and POSTs them with your settings to `/api/code`. The server builds
a plan (final prompt, the JSON schema of the tool the model must call, batches, token budget),
codes the batches five at a time with retries, and streams each coded unit, each API log and a
progress counter back as Server-Sent Events. The browser appends them to the file as they arrive.

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
| `useTranscriptFiles.ts` | Upload: the file list, drag-and-drop, JSON reading, audio transcription, the ElevenLabs key. |
| `useModelAndKeys.ts` | Model: selected model, reasoning level, the three provider keys, the active provider. |
| `useSchemeSettings.ts` | Scheme: scheme, categories, coding mode, prompt, context before/after. |
| `useCodingRun.ts` | Run: `runCoding`, reading the stream, API logs, progress, export-all. |
| `useSessionPersistence.ts`, `useAutosave.ts`, `autosave-schema.ts` | Loading the saved session on start, the snapshot to save, the debounced writer, and the saved shape with its migrations. |
| `useRunScope.ts`, `useRunStats.ts`, `useScrollSpy.ts` | Pre-run call count; live elapsed/rate/ETA/cost; which step is in view. |

**Library (`lib/`), in pipeline order**

| Folder / file | What it does |
|---|---|
| `types.ts` | Every shared type and default. Read this first. |
| `models.ts`, `usage.ts` | Model catalog with prices; token-usage normalisation and cost math. |
| `transcript/` | Words → speaking turns (`parse-transcript.ts`), the segmentation seam (`segment.ts`), fixed time windows (`segment-time.ts`). |
| `schemes/` | One file per coding scheme, the registry (`index.ts`), and the editable default prompt builder (`default-prompt.ts`). |
| `coding/` | Server-side engine: final prompt and user message (`build-messages.ts`), the forced tool schema and token budget (`build-tool.ts`), batching (`batching.ts`), the run plan, retry loop and worker pool (`code-segments.ts`), turning tool payloads into rows (`parse-response.ts`), the SSE wire format (`sse.ts`). |
| `llm/` | One adapter per provider behind `runStructuredCall()` (`index.ts`). |
| `results/` | What happens to coded units after they come back: utterance re-timing, ordering, CSV, category colours. |
| `utils.ts` | shadcn's `cn()` helper. |

**Results UI (`app/coding/components/run/`)**: `ConversationCard.tsx` (one card per file),
`RunRow.tsx` (one coded unit), `CategoryHistogram.tsx`, `ExportButton.tsx` + `ExportDialog.tsx`.

**UI kit**: `components/ui/*` are shadcn primitives (button, checkbox, dialog, label, select).
Most of the app is styled with CSS modules next to each component, not Tailwind.

Every source file starts with a header comment saying what it is, which step it belongs to, and
whether it runs on the server, the client, or both.

## `POST /api/code`

The body the browser sends (`CodeRequest` in `app/api/code/route.ts`):

| Field | Meaning |
|---|---|
| `segments` | The units to code, already cut by `lib/transcript/segment.ts` (`PreSegment[]`). |
| `mode` | `{ segmentation, outputType, scale?, windowSeconds?, perSpeaker?, batchSize? }` (`CodingMode`). |
| `model` | A model id from `lib/models.ts`. The server resolves the provider from it. |
| `reasoningEffort` | `none` / `low` / `medium` / `high`; only forwarded for models flagged `reasoning`. |
| `categories` | `{ name, description }[]`; at least two non-blank names. In continuous mode these are the rating dimensions. |
| `systemPrompt` | The prompt from the editor. The server appends the category (or rating) block. |
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

Inside: units are batched (`batchSize`, capped per method), each batch gets up to three attempts
to parse, still-missing units of a multi-unit batch are re-coded alone, and five batches run at
once. A unit that never parses becomes a row with `error: true`.

## `POST /api/transcribe`

Multipart form with the audio `file` and ElevenLabs options; the key goes in the
`x-elevenlabs-key` header. The route forwards the body to ElevenLabs and returns its JSON.

## Where state lives

- **React state**, one hook per step (see the State table). Coded results live only in memory.
- **localStorage**: `anthropic_api_key`, `openai_api_key`, `google_api_key`, `elevenlabs_api_key`,
  and `ccc_session_v3` (the autosaved session: files with their transcripts, model, scheme,
  categories, prompt, mode, context). The saved shape and its v3→v6 migration are in
  `app/coding/hooks/autosave-schema.ts`. Sessions over 3 MB are saved without transcripts.
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
- **Change what the model is asked**: `lib/schemes/default-prompt.ts` for the editable default,
  `lib/coding/build-messages.ts` for what is appended and how context is laid out,
  `lib/coding/build-tool.ts` for the JSON shape the model must return.
- **Change how a response becomes rows**: `lib/coding/parse-response.ts`.
- **Change retries, batching or concurrency**: `lib/coding/code-segments.ts`, `lib/coding/batching.ts`.
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
