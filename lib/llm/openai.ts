import OpenAI from "openai";
import type { StructuredCallParams, StructuredCallResult } from "./types";

/** o-series reasoning models (o3, o3-pro, …) always reason. GPT-5.x reason when
 *  the caller passes an explicit effort. */
function isReasoningModel(model: string): boolean {
  return /^o\d/.test(model);
}

/**
 * Map the app's effort levels onto a Responses-API `reasoning.effort` value.
 * The Responses API has no "none"; "minimal" is its lowest setting. Anything
 * unrecognized (incl. undefined for an o-series model carrying no explicit
 * selection) falls back to "medium".
 */
function toResponsesEffort(
  effort: string | undefined,
): "minimal" | "low" | "medium" | "high" {
  switch (effort) {
    case "none":
      return "minimal";
    case "low":
    case "medium":
    case "high":
      return effort;
    default:
      return "medium";
  }
}

/**
 * OpenAI structured call with a forced function tool. The JSON Schema
 * `input_schema` is passed straight through as the function `parameters`
 * (standard JSON Schema; nullable via `["string","null"]` is accepted). The
 * route validates/retries the result defensively, so strict mode is not
 * required. We never send `temperature` for any provider.
 *
 * Reasoning models (GPT-5.x with an effort, or o-series) go through the
 * Responses API: `/v1/chat/completions` rejects `reasoning_effort` together with
 * function tools ("Please use /v1/responses instead"). Non-reasoning models stay
 * on Chat Completions.
 */
export async function runOpenAI(
  p: StructuredCallParams,
): Promise<StructuredCallResult> {
  const client = new OpenAI({ apiKey: p.apiKey });
  const effort = p.reasoningEffort;
  const reasoning = !!effort || isReasoningModel(p.model);

  if (reasoning) {
    const respBody: Record<string, unknown> = {
      model: p.model,
      instructions: p.system,
      input: p.user,
      tools: [
        {
          type: "function",
          name: p.tool.name,
          description: p.tool.description,
          parameters: p.tool.input_schema,
          strict: false,
        },
      ],
      tool_choice: { type: "function", name: p.tool.name },
      reasoning: { effort: toResponsesEffort(effort) },
      // Reasoning tokens count as output, so give generous headroom on top of
      // the (small) structured-output budget. Cap, not reservation — billed on
      // tokens actually produced.
      max_output_tokens: Math.max(p.maxTokens, 8000),
      // This is the user's own key and the input is their transcript; don't have
      // OpenAI retain the response server-side.
      store: false,
    };

    const response = (await client.responses.create(
      respBody as unknown as Parameters<typeof client.responses.create>[0],
    )) as {
      output?: Array<{ type?: string; arguments?: string }>;
      usage?: unknown;
    };

    // The function call is one item in the output array (reasoning models emit a
    // reasoning item first); its `arguments` is a JSON string.
    const fnCall = (response.output ?? []).find(
      (it) => it?.type === "function_call",
    );
    let input: unknown;
    if (fnCall && typeof fnCall.arguments === "string") {
      try {
        input = JSON.parse(fnCall.arguments);
      } catch {
        input = undefined;
      }
    }
    return { input, raw: response };
  }

  const body: Record<string, unknown> = {
    model: p.model,
    max_completion_tokens: Math.max(p.maxTokens, 2000),
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
  };

  const completion = (await client.chat.completions.create(
    body as unknown as Parameters<typeof client.chat.completions.create>[0],
  )) as OpenAI.Chat.Completions.ChatCompletion;

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
