import Anthropic from "@anthropic-ai/sdk";
import type { StructuredCallParams, StructuredCallResult } from "./types";

/**
 * Anthropic Messages API with a forced tool call. This is the original wiring
 * that lived inline in the route, moved here behind the common interface.
 */
export async function runAnthropic(
  p: StructuredCallParams,
): Promise<StructuredCallResult> {
  const client = new Anthropic({ apiKey: p.apiKey });
  const message = await client.messages.create({
    model: p.model,
    max_tokens: p.maxTokens,
    system: p.system,
    messages: [{ role: "user", content: p.user }],
    tools: [
      {
        name: p.tool.name,
        description: p.tool.description,
        input_schema: p.tool.input_schema as Anthropic.Tool["input_schema"],
      },
    ],
    tool_choice: { type: "tool", name: p.tool.name },
  });

  const toolBlock = message.content.find(
    (b): b is Anthropic.ToolUseBlock => b.type === "tool_use",
  );
  return { input: toolBlock?.input, raw: message };
}
