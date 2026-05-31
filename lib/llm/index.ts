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
