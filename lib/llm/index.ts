/**
 * WHAT:    One entry point for "call the model with a forced tool": picks the
 *          provider adapter (Anthropic / OpenAI / Google) by provider id. To add a
 *          provider, add an adapter file here and a case in the switch.
 * STEP:    Run, server side. Called by lib/coding/code-segments.ts.
 * RUNS ON: server only (SDK clients, API keys)
 */
import { runAnthropic } from "./anthropic";
import { runOpenAI } from "./openai";
import { runGoogle } from "./google";
import type { StructuredCallParams, StructuredCallResult } from "./types";

export type { LlmTool, StructuredCallParams, StructuredCallResult } from "./types";

/**
 * Provider-neutral forced structured call. Dispatches to the right SDK adapter
 * by `provider`, returning the parsed function-call `input` plus the `raw`
 * provider response (for logging). Every adapter forces exactly one call to the
 * `code_exchange` tool, so callers can treat the result identically.
 */
export async function runStructuredCall(
  params: StructuredCallParams,
): Promise<StructuredCallResult> {
  switch (params.provider) {
    case "openai":
      return runOpenAI(params);
    case "google":
      return runGoogle(params);
    case "anthropic":
    default:
      return runAnthropic(params);
  }
}
