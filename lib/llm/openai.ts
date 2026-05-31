import OpenAI from "openai";
import type { StructuredCallParams, StructuredCallResult } from "./types";

/** o-series reasoning models (o3, o3-pro, …) need extra constraints. */
function isReasoningModel(model: string): boolean {
  return /^o\d/.test(model);
}

/**
 * OpenAI Chat Completions with a forced function call. The JSON Schema
 * `input_schema` is passed straight through as the function `parameters`
 * (standard JSON Schema; nullable via `["string","null"]` is accepted). The
 * route validates/retries the result defensively, so strict mode is not
 * required. Reasoning models disallow `temperature` and use
 * `max_completion_tokens`; we never send `temperature` for any provider.
 */
export async function runOpenAI(
  p: StructuredCallParams,
): Promise<StructuredCallResult> {
  const client = new OpenAI({ apiKey: p.apiKey });
  const reasoning = isReasoningModel(p.model);

  const completion = await client.chat.completions.create({
    model: p.model,
    // GPT-5.x/o-series spend tokens thinking before the function call, so give
    // generous headroom on top of the (small) structured-output budget. This is
    // a cap, not a reservation — billing is on tokens actually produced.
    max_completion_tokens: reasoning
      ? Math.max(p.maxTokens, 8000)
      : Math.max(p.maxTokens, 2000),
    messages: [
      { role: "system", content: p.system },
      { role: "user", content: p.user },
    ],
    tools: [
      {
        type: "function",
        function: {
          name: p.tool.name,
          description: p.tool.description,
          parameters: p.tool.input_schema,
        },
      },
    ],
    tool_choice: { type: "function", function: { name: p.tool.name } },
    ...(reasoning ? { reasoning_effort: "medium" as const } : {}),
  });

  const toolCall = completion.choices?.[0]?.message?.tool_calls?.[0] as
    | { function?: { arguments?: string } }
    | undefined;
  const argsStr = toolCall?.function?.arguments;
  let input: unknown;
  if (typeof argsStr === "string") {
    try {
      input = JSON.parse(argsStr);
    } catch {
      input = undefined;
    }
  }
  return { input, raw: completion };
}
