/**
 * WHAT:    The provider-neutral shapes every adapter accepts and returns: the tool
 *          definition, the call parameters, and the parsed-input plus raw-response
 *          result.
 * STEP:    Run, server side.
 * RUNS ON: server only (types)
 */
import type { ProviderId } from "@/lib/models";

/**
 * Provider-neutral forced-tool definition. This is exactly the shape
 * `buildCodingTool` (lib/coding-tool.ts) already produces for Anthropic — each
 * adapter translates `input_schema` into its provider's function-calling format.
 */
export interface LlmTool {
  name: string;
  description?: string;
  input_schema: Record<string, unknown>;
}

export interface StructuredCallParams {
  provider: ProviderId;
  model: string;
  apiKey: string;
  system: string;
  user: string;
  tool: LlmTool;
  maxTokens: number;
  /** OpenAI reasoning effort ("none" | "low" | "medium" | "high"); ignored by other providers. */
  reasoningEffort?: string;
}

export interface StructuredCallResult {
  /** Parsed function/tool-call arguments object, or undefined if none/parse-failed. */
  input: unknown;
  /** Raw provider response, kept verbatim for the API log. */
  raw: unknown;
}
