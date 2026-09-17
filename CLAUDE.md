# Working in this repo

Read `README.md` first: it has the file map (one table per UI step), the `/api/code` contract,
and "where to look when you want to…". `docs/REFACTOR_2026-09.md` lists the known open bugs.

## Layout in one breath

`/coding` is four steps: Upload → Model → Scheme → Run. Each step has a section component in
`app/coding/components/sections/`, a hook in `app/coding/hooks/`, and library code in `lib/`
grouped in pipeline order: `transcript/` → `schemes/` → `coding/` (server engine) → `llm/`
(provider adapters) → `results/`. `lib/types.ts` holds every shared type.

## Rules

- Every source file starts with a `WHAT / STEP / RUNS ON` header comment. Update it when the
  file's job changes; add one to any new file.
- Server-only modules: `lib/coding/{build-messages,build-tool,parse-response,code-segments}.ts`
  and everything in `lib/llm/`. Never import them from a `"use client"` file.
- New state goes in the hook for its step (`useTranscriptFiles`, `useModelAndKeys`,
  `useSchemeSettings`, `useCodingRun`). `useCodingSession.ts` only composes; keep it logic-free.
- Anything persisted changes `autosave-schema.ts`: bump the version and add a migration line
  so old saved sessions still load. The localStorage key name `ccc_session_v3` is frozen.
- The tool name `code_exchange` and the prompt text change what the model sees; treat edits
  there as behaviour changes, not refactors.
- API keys are entered in the browser and travel only inside the request they authorise.
  Nothing reads `process.env`.
- A human-coded CSV's codes (`CsvRow.values` under `TranscriptFile.source`) never reach a
  `PreSegment` or the `/api/code` body: `segmentFile` builds units from `turns` only, and the
  request body is an explicit field list. `scripts/check-csv.ts` asserts it; keep it passing.
- Run `npx tsc --noEmit && npm run lint && npm run build` before committing. `next build` does
  not lint.

## Which files for which change

| Change | Open |
|---|---|
| Upload / transcription behaviour | `hooks/useTranscriptFiles.ts`, `sections/SectionUpload.tsx`, `app/api/transcribe/route.ts` |
| Human-coded CSV input, agreement | `lib/transcript/parse-csv.ts`, `lib/transcript/csv-conversations.ts`, `lib/results/agreement.ts`, `components/run/ConfusionMatrix.tsx`, `scripts/check-csv.ts` |
| Models, prices, providers | `lib/models.ts`, `lib/llm/` |
| Schemes, categories, default prompt | `lib/schemes/`, `hooks/useSchemeSettings.ts`, `sections/SectionScheme.tsx` |
| What the model is sent / must return | `lib/coding/build-messages.ts`, `lib/coding/build-tool.ts` |
| Parsing responses, retries, batching, concurrency | `lib/coding/parse-response.ts`, `lib/coding/code-segments.ts`, `lib/coding/retry.ts`, `lib/coding/batching.ts` |
| The run UI, progress, cost, stop | `hooks/useCodingRun.ts`, `hooks/useRunStats.ts`, `sections/SectionRun.tsx`, `components/run/` |
| CSV export | `lib/results/generate-csv.ts`, `lib/results/csv-escape.ts`, `components/run/ExportDialog.tsx`, `lib/types.ts` (`COLUMN_DEFINITIONS`) |
| Audit export (CSV input + results) | `lib/results/generate-audit-csv.ts`, `components/run/AuditExportDialog.tsx`, `lib/types.ts` (`RunConfigSnapshot`) |
| Autosave | `hooks/useSessionPersistence.ts`, `hooks/autosave-schema.ts`, `hooks/useAutosave.ts` |
| The `/logs` page | `app/logs/page.tsx`, `app/logs/PromptViewer.tsx` |
| Landing page copy | `app/page.tsx` (hand-typed; keep in step with `lib/`) |
